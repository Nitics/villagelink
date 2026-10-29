// In-memory stand-in for the Supabase client, shaped like the real VillageLink tables.
// @ts-nocheck
// In-memory stand-in for Supabase, used only by the e2e build (npm run build:e2e).
export const createClient = (() => {
  const uid=()=>'00000000-0000-4000-8000-'+Math.random().toString(16).slice(2,14).padEnd(12,'0');
  const now=()=>new Date().toISOString();
  const USERS={
    'cust@test.co.za':{id:'u-cust',email:'cust@test.co.za',role:'customer',name:'Thandi'},
    'owner@test.co.za':{id:'u-owner',email:'owner@test.co.za',role:'customer',name:'OneStop owner'},
    'staff@test.co.za':{id:'u-staff',email:'staff@test.co.za',role:'staff',name:''},
    'admin@test.co.za':{id:'u-admin',email:'admin@test.co.za',role:'admin',name:'Super'}
  };
  const db={
    businesses:[
      {id:'b1',name:'OneStop Tuck Shop',category:'spaza',type_label:'Spaza shop',town:'KaMaqhekeza',address:'Sbhokwane 1321',phone:'072 000 0000',whatsapp:'072 000 0000',opening_hours:'Mo-Su 06:00-20:30',hours_checked:'2026-10-19',sells_online:true,plan:'verified',latitude:null,longitude:null,description:'Bread and airtime',source:'yours',confirmed_open:null,confirmed_at:null,confirmed_note:null,is_active:true,created_at:now()},
      {id:'b2',name:'Praxoz',category:'fuel',type_label:'24-hour fuel station',town:'Malelane',address:'Next to TSB',phone:'013 000 0000',whatsapp:'0723732395',opening_hours:'24/7',hours_checked:'2026-10-19',sells_online:false,plan:'free',latitude:null,longitude:null,description:null,source:'yours',confirmed_open:null,confirmed_at:null,confirmed_note:null,is_active:true,created_at:now()},
      {id:'b3',name:'Mangweni Clinic',category:'clinic',type_label:'Community clinic',town:'Tonga',address:'R571 Main Road',phone:'013 000 0000',whatsapp:'0723732395',opening_hours:'Mo-Fr 07:00-16:00; Sa,Su off',hours_checked:'2026-10-19',sells_online:false,plan:'free',latitude:null,longitude:null,description:null,source:'yours',confirmed_open:null,confirmed_at:null,confirmed_note:null,is_active:true,created_at:now()}
    ],
    products:[{id:'p1',business_id:'b1',name:'White bread',price:'18.00',unit:'loaf',in_stock:true,sort_order:0},{id:'p2',business_id:'b1',name:'Sugar 2.5 kg',price:'52.00',unit:'bag',in_stock:false,sort_order:1}],
    listings:[],jobs:[],study_groups:[],group_members:[],status_reports:[],orders:[],order_items:[],plan_requests:[],
    profiles:[],business_members:[{business_id:'b1',user_id:'u-owner'}],
    towns:['Malelane','Komatipoort','Hectorspruit','Marloth Park','KaMaqhekeza','Kamhlushwa','Tonga','Mangweni','Naas','Schoemansdal','Jeppes Reef','Driekoppies','Mbuzini','Steenbok','Langeloop'].map((name,i)=>({name,sort_order:i+1}))
  };
  Object.values(USERS).forEach(u=>db.profiles.push({id:u.id,role:u.role,display_name:u.name}));
  let session=null;const listeners=[];
  const roleOf=(me)=>me?((db.profiles.find(p=>p.id===me.id)||{}).role||'customer'):'anon';
  const staffish=(me)=>['staff','admin'].includes(roleOf(me));
  window.__fake={db,calls:[]};

  function builder(table){
    let rows=null,op='select',payload=null,filters=[],single=false,maybe=false,lim=null,orders=[],selectAfter=false,embed=false;
    const api={
      select(cols){if(op==='select'){embed=/order_items/.test(cols||'')}else selectAfter=true;return api},
      insert(p){op='insert';payload=Array.isArray(p)?p:[p];return api},
      update(p){op='update';payload=p;return api},
      delete(){op='delete';return api},
      eq(c,v){filters.push(r=>r[c]===v);return api},
      gte(c,v){filters.push(r=>r[c]>=v);return api},
      order(c,o){orders.push([c,o&&o.ascending===false?-1:1]);return api},
      limit(n){lim=n;return api},
      single(){single=true;return api},
      maybeSingle(){maybe=true;return api},
      then(res,rej){return Promise.resolve().then(run).then(res,rej)}
    };
    function run(){
      window.__fake.calls.push(table+':'+op);
      if(window.__offline)return {data:null,error:{message:'Failed to fetch'}};
      const T=db[table];
      const me=session&&session.user;
      if(op==='insert'){
        if(!me)return {data:null,error:{message:'new row violates row-level security policy',code:'42501'}};
        const out=payload.map(p=>{
          const r={id:uid(),created_at:now(),...p};
          if(table==='listings'){r.owner_id=me.id;r.is_active=true}
          if(table==='jobs'){r.owner_id=me.id;r.is_active=true;r.is_filled=false}
          if(table==='study_groups')r.owner_id=me.id;
          if(table==='group_members'||table==='status_reports'||table==='plan_requests')r.user_id=me.id;
          if(table==='plan_requests')r.status='new';
          if(table==='products'){r.in_stock=true;r.sort_order=0}
          if(table==='businesses'){
            if(T.some(b=>b.name.toLowerCase()===r.name.toLowerCase()&&b.town===r.town))return {dup:true};
            Object.assign(r,{is_active:true,confirmed_at:null,source:'yours'});
          }
          return r;
        });
        if(out.some(o=>o.dup))return {data:null,error:{message:'duplicate key value violates unique constraint',code:'23505'}};
        T.push(...out);
        return {data:single?out[0]:out,error:null};
      }
      let list=T.filter(r=>filters.every(f=>f(r)));
      if((op==='update'||op==='delete')&&table==='jobs'&&!staffish(me))list=list.filter(j=>me&&j.owner_id===me.id);
      if(op==='update'){
        if(table==='towns'&&payload.name)list.forEach(t=>db.businesses.forEach(b=>{if(b.town===t.name)b.town=payload.name}));
        list.forEach(r=>Object.assign(r,payload));return {data:single?list[0]:list,error:null}}
      if(op==='delete'){
        if(table==='towns'&&list.some(t=>db.businesses.some(b=>b.town===t.name)))return {data:null,error:{message:'violates foreign key constraint',code:'23503'}};
        if(['orders','plan_requests','status_reports','towns'].includes(table)&&roleOf(me)!=='admin')return {data:null,error:null};
        db[table]=T.filter(r=>!list.includes(r));return {data:null,error:null}}
      if(table==='businesses'&&!staffish(me))list=list.filter(b=>b.is_active!==false);
      if(table==='jobs'&&!staffish(me))list=list.filter(j=>j.is_active!==false||(me&&j.owner_id===me.id));
      if(table==='listings'&&!staffish(me))list=list.filter(l=>l.is_active!==false||(me&&l.owner_id===me.id));
      if(table==='orders'){list=list.filter(o=>me&&(o.customer_id===me.id||staffish(me)||db.business_members.some(m=>m.user_id===me.id&&m.business_id===o.business_id)))}
      if(table==='plan_requests'){list=list.filter(r=>me&&(r.user_id===me.id||staffish(me)))}
      list=list.map(r=>embed?{...r,order_items:db.order_items.filter(i=>i.order_id===r.id)}:{...r});
      for(const [c,d] of orders.reverse())list.sort((a,b)=>(a[c]>b[c]?1:a[c]<b[c]?-1:0)*d);
      if(lim)list=list.slice(0,lim);
      if(single||maybe)return {data:list[0]||null,error:null};
      return {data:list,error:null};
    }
    return api;
  }
  const err=(m,code='22023')=>({data:null,error:{message:m,code}});
  const client={
    from:builder,
    async rpc(name,a){
      window.__fake.calls.push('rpc:'+name);
      const me=session&&session.user;
      if(!me)return err('permission denied for function '+name,'42501');
      const isStaff=staffish(me),member=bid=>db.business_members.some(m=>m.user_id===me.id&&m.business_id===bid);
      if(name==='admin_list_users'){
        if(roleOf(me)!=='admin')return err('Only super users can see all accounts','42501');
        return {data:Object.values(USERS).map(u=>{const p=db.profiles.find(x=>x.id===u.id)||{};return {id:u.id,email:u.email,display_name:p.display_name||'',role:p.role||'customer',created_at:now(),last_sign_in_at:null,business_ids:db.business_members.filter(m=>m.user_id===u.id).map(m=>m.business_id)}}),error:null};
      }
      if(name==='admin_update_user'){
        if(roleOf(me)!=='admin')return err('Only super users can change accounts','42501');
        if(a.p_user===me.id&&a.p_role!=='admin')return err('You can’t remove your own super user role. Ask another super user.');
        const p=db.profiles.find(x=>x.id===a.p_user);p.role=a.p_role;if(a.p_display_name)p.display_name=a.p_display_name;return {data:null,error:null};
      }
      if(name==='place_order'){
        const b=db.businesses.find(x=>x.id===a.p_business_id);
        if(!b||!b.sells_online)return err('This shop is not taking orders');
        if(a.p_method==='delivery'&&!a.p_delivery_address)return err('Add a delivery address or landmark');
        const o={id:uid(),business_id:b.id,customer_id:me.id,customer_name:a.p_customer_name,customer_phone:a.p_customer_phone,method:a.p_method,delivery_address:a.p_delivery_address,note:a.p_note,status:'sent',total:0,created_at:now()};
        let total=0;
        for(const it of a.p_items){const p=db.products.find(x=>x.id===it.product_id&&x.business_id===b.id);if(!p)return err('A product is not sold by this shop');if(!p.in_stock)return err(p.name+' is out of stock');db.order_items.push({order_id:o.id,product_name:p.name,unit_price:p.price,qty:it.qty});total+=+p.price*it.qty}
        o.total=total.toFixed(2);db.orders.push(o);return {data:o.id,error:null};
      }
      if(name==='cancel_order'){const o=db.orders.find(x=>x.id===a.p_order_id&&x.customer_id===me.id&&x.status==='sent');if(!o)return err('This order can no longer be cancelled');o.status='cancelled';return {data:null,error:null}}
      if(name==='set_order_status'){const o=db.orders.find(x=>x.id===a.p_order_id);if(!o||!(isStaff||member(o.business_id)))return err('Order not found','42501');o.status=a.p_status;return {data:null,error:null}}
      if(name==='confirm_business_status'){if(!(isStaff||member(a.p_business_id)))return err('Only this business can confirm its status','42501');Object.assign(db.businesses.find(x=>x.id===a.p_business_id),{confirmed_open:a.p_open,confirmed_at:now(),confirmed_note:a.p_note});return {data:null,error:null}}
      if(name==='update_business_details'){if(!(isStaff||member(a.p_business_id)))return err('Only this business can change its details','42501');const b=db.businesses.find(x=>x.id===a.p_business_id);for(const [k,c] of [['p_phone','phone'],['p_whatsapp','whatsapp'],['p_address','address'],['p_opening_hours','opening_hours'],['p_description','description']])if(a[k]!=null)b[c]=a[k];return {data:null,error:null}}
      return err('unknown rpc');
    },
    functions:{
      async invoke(name,{body}){
        window.__fake.calls.push('fn:'+name);
        if(!session)return {data:null,error:{context:new Response(JSON.stringify({error:'Sign in to ask VillageLink a question.',code:'signin'}),{status:401})}};
        const q=body.messages[body.messages.length-1].content;
        return {data:{text:'['+body.mode+'] answer to: '+q},error:null};
      }
    },
    auth:{
      async getSession(){return {data:{session}}},
      onAuthStateChange(fn){listeners.push(fn);return {data:{subscription:{unsubscribe(){}}}}},
      async signInWithPassword({email,password}){
        const u=USERS[email];if(!u||password!=='password123')return {data:{},error:{message:'Invalid login credentials'}};
        session={user:{id:u.id,email:u.email}};listeners.forEach(f=>f('SIGNED_IN',session));return {data:{user:session.user,session},error:null};
      },
      async signUp({email}){return {data:{user:{id:'new',email},session:null},error:null}},
      async signOut(){session=null;listeners.forEach(f=>f('SIGNED_OUT',null));return {error:null}},
      async resetPasswordForEmail(){return {error:null}},
      async updateUser(){return {error:null}}
    }
  };
  return () => client;
})();

