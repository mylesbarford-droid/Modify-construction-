(()=> {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let currentUser=null;
  const css=`
  #modify-auth-cover{position:fixed;inset:0;z-index:10000;background:#090a0c;color:#f5f1e7;display:grid;place-items:center;padding:20px;font-family:system-ui,sans-serif}
  #modify-auth-cover .authbox .auth-logo{display:block;width:min(100%,300px);height:auto;margin:0 auto 18px}\n  #modify-auth-cover .authbox{width:min(420px,100%);background:#1a1c20;border:1px solid #c6a34a;border-radius:16px;padding:25px;box-shadow:0 20px 70px #0009}
  #modify-auth-cover h1{margin:0 0 5px;font-size:25px}#modify-auth-cover p{color:#b8b5ac;font-size:13px}
  #modify-auth-cover label{display:block;font-size:12px;margin:13px 0 5px;color:#e0c477}
  #modify-auth-cover input,#modify-staff-panel input,#modify-staff-panel select,#modify-job-api select,#modify-job-api textarea{width:100%;padding:11px;border:1px solid #48443a;border-radius:8px;background:#111317;color:#f4f1e8}
  #modify-auth-cover button,#modify-staff-panel button,#modify-job-api button{background:#c6a34a;color:#090a0c;border:0;border-radius:8px;padding:11px 15px;font-weight:750;cursor:pointer}
  #modify-auth-cover button{width:100%;margin-top:18px}#modify-auth-error{color:#ffaaaa;min-height:20px}
  #modify-account{display:flex;gap:8px;align-items:center;font-size:12px;color:#e0c477}
  #modify-account button{padding:7px 10px;background:#29251c;color:#e0c477;border:1px solid #80652d;border-radius:7px}
  #modify-staff-panel{position:fixed;z-index:9998;inset:8% 5%;overflow:auto;background:#17191d;color:#f4f1e8;border:1px solid #c6a34a;border-radius:14px;padding:22px;box-shadow:0 20px 80px #000b}
  #modify-staff-panel .staffgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  #modify-staff-panel .stafffield{display:grid;gap:5px;font-size:12px;color:#e0c477}
  #modify-staff-panel .staffrow{padding:10px;border-bottom:1px solid #39352b;display:flex;justify-content:space-between;gap:10px;align-items:center}
  #modify-job-api .api-card{background:#1a1c20;border:1px solid #39352b;border-radius:13px;padding:18px;margin:0 0 14px;color:#f4f1e8}
  #modify-job-api .api-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  #modify-job-api label{display:grid;gap:5px;font-size:12px;color:#e0c477}
  #modify-job-api textarea{min-height:70px}
  #modify-job-api .api-wide{grid-column:1/-1}
  #modify-job-api .api-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  #modify-job-api .api-item{padding:13px;border:1px solid #39352b;border-radius:10px;margin:10px 0;background:#15171b}
  #modify-job-api .api-item small{color:#b8b5ac}
  #modify-schedule{color:var(--ink,#17202b)}
  #modify-schedule .schedule-card{background:#fff;border:1px solid #e3e7ec;border-radius:15px;padding:20px;box-shadow:0 4px 18px rgba(20,27,38,.04)}
  #modify-schedule .schedule-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
  #modify-schedule .schedule-toolbar h2{font-size:24px;letter-spacing:-.6px;margin:0 0 5px;color:#151a22}
  #modify-schedule .schedule-toolbar p{font-size:13px;color:#687386;margin:3px 0}
  #modify-schedule #schedule-range{font-weight:700;color:#17202b;margin-top:8px}
  #modify-schedule .schedule-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  #modify-schedule .schedule-actions button{border:1px solid #dce1e8;background:#fff;color:#202938;border-radius:9px;padding:10px 13px;font-weight:650;cursor:pointer}
  #modify-schedule .schedule-actions button.primary{background:#f36b0b;border-color:#f36b0b;color:#fff}
  #modify-schedule .schedule-actions button:hover{filter:brightness(.96)}
  #modify-schedule .schedule-scroll{overflow:auto;border:1px solid #dce1e8;border-radius:12px;background:#fff}
  #modify-schedule table{border-collapse:separate;border-spacing:0;width:100%;min-width:1050px;background:#fff}
  #modify-schedule th,#modify-schedule td{border:0;border-right:1px solid #e0e4ea;border-bottom:1px solid #e0e4ea;padding:9px;vertical-align:top;text-align:left}
  #modify-schedule thead th{height:62px;background:#25282d;color:#fff;font-size:13px;font-weight:750;text-align:center;white-space:nowrap}
  #modify-schedule thead th:first-child{text-align:left;padding-left:16px}
  #modify-schedule .worker-col{min-width:190px;width:190px;position:sticky;left:0;background:#fff;color:#18202b;z-index:1;font-weight:750;vertical-align:middle}
  #modify-schedule thead .worker-col{background:#25282d;z-index:2;color:#fff}
  #modify-schedule .worker-col small{display:block;color:#778294;font-size:11px;font-weight:500;margin-top:4px}
  #modify-schedule .day-col{min-width:128px}
  #modify-schedule tbody td{height:104px;background:#fff}
  #modify-schedule tbody tr:nth-child(even) td{background:#fbfcfd}
  #modify-schedule tbody tr:hover td{background:#fffaf6}
  #modify-schedule .shift{display:block;width:100%;text-align:left;background:#fff0e4;border:1px solid #f8c49f;border-left:4px solid #f36b0b;border-radius:8px;padding:10px;margin:2px 0 6px;font-size:12px;cursor:pointer;color:#20242b;line-height:1.4}
  #modify-schedule .shift:hover{background:#ffe4d1;border-color:#efaa79}
  #modify-schedule .shift strong{display:block;color:#b84d08;font-size:13px;margin-bottom:4px}
  #modify-schedule .empty-slot{display:block;width:100%;height:78px;background:transparent;border:1px dashed transparent;border-radius:8px;cursor:pointer}
  #modify-schedule .empty-slot:hover,#modify-schedule .empty-slot:focus-visible{background:#fff8f3;border-color:#efb48c;outline:none}
  #modify-schedule .schedule-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}
  #modify-schedule label{display:grid;gap:5px;color:#687386;font-size:12px}
  #modify-schedule input,#modify-schedule select,#modify-schedule textarea{width:100%;padding:10px;border:1px solid #dce1e8;border-radius:8px;background:#fff;color:#17202b}
  #modify-schedule .wide{grid-column:1/-1}
  #modify-schedule #schedule-editor{margin-top:18px;background:#fbfcfd;border:1px solid #e0e4ea;border-radius:11px;padding:18px}
  #modify-schedule #schedule-editor h3{margin:0 0 10px;font-size:16px}
  #modify-schedule #schedule-editor .api-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
  #modify-schedule #schedule-editor button{border:1px solid #dce1e8;background:#fff;color:#20242b;border-radius:8px;padding:9px 13px;cursor:pointer}
  #modify-schedule #schedule-editor #sch-save{background:#f36b0b;border-color:#f36b0b;color:#fff}
  #modify-schedule #schedule-message{color:#b84d08;font-size:13px;margin:8px 0}
  @media(max-width:700px){#modify-schedule .schedule-form{grid-template-columns:1fr}#modify-schedule .wide{grid-column:auto}#modify-schedule .schedule-card{padding:12px}#modify-schedule .schedule-toolbar h2{font-size:20px}#modify-schedule .schedule-actions button{padding:9px 10px}}
  @media(max-width:600px){#modify-staff-panel .staffgrid,#modify-job-api .api-grid{grid-template-columns:1fr}#modify-job-api .api-wide{grid-column:auto}#modify-staff-panel{inset:3% 3%}}
  `;
  const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
  const cover=document.createElement("div");cover.id="modify-auth-cover";cover.innerHTML='<div class="authbox"><img class="auth-logo" src="/logo.svg" alt="MODIFY Construction"><p>Opening company workspace…</p><div id="modify-auth-error" role="alert"></div></div>';
  document.body.appendChild(cover);
  const api=async(path,opts={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(path,{credentials:"same-origin",...opts,signal:controller.signal,headers:{...(opts.body instanceof FormData?{}:{"content-type":"application/json"}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed ("+r.status+")");return data}catch(e){if(e.name==="AbortError")throw new Error("Request timed out while loading "+path+". Please try again.");throw e}finally{clearTimeout(timer)}};
  function accountBar(){let bar=$("#modify-account");if(!bar){bar=document.createElement("div");bar.id="modify-account";const top=$(".top");if(top)top.appendChild(bar)}if(bar)bar.innerHTML='<span>Open company access · no password</span>'}
  const moduleMap={
    "Money":"money","Plant & Equipment":"plant","Vehicles":"vehicles","Workforce":"workforce",
    "Health & Safety":"safety",
    "Documents":"documents","Suppliers & Materials":"suppliers","Job Materials":"materials",
    "Specialist Tooling":"tooling","Timesheets":"timesheets","Daily Reports":"daily_reports"
  };
  let syncingModules=false, syncQueue=Promise.resolve();
  const pendingModuleDeletes=[];
  const pendingModuleUpserts=new Map();
  const originalSetItem=Storage.prototype.setItem;
  function moduleJobNumber(record){
    const direct=record["Job number"]||record.jobNumber||record.job_number;
    if(direct)return String(direct);
    const name=String(record["Job / project"]||record["Job / project name"]||record["Allocated job / site"]||record["Location / allocated job"]||record["Project"]||"").trim().toLowerCase();
    if(!name)return "";
    const job=sharedJobs.find(j=>String(j.project_name||"").trim().toLowerCase()===name);
    return job?.job_number||"";
  }
  async function syncOperationalRegisters(){
    if(syncingModules)return;
    syncingModules=true;
    try{
      while(pendingModuleDeletes.length){
        const item=pendingModuleDeletes[0];
        await api("/api/modules/"+item.module+"/records/"+encodeURIComponent(item.id),{method:"DELETE"});
        pendingModuleDeletes.shift();
      }
      const jobs=await api("/api/jobs");sharedJobs=jobs.jobs||[];
      const raw=localStorage.getItem("modifyRecordsV2");
      const state=raw?JSON.parse(raw):{};
      // Automatically migrate legacy Jobs & Sites saved in this browser into the
      // shared jobs table. The previous flow only offered a manual import button
      // on the Jobs page, leaving Job Updates with an empty shared dropdown.
      const legacyJobs=Array.isArray(state["Jobs & Sites"])?state["Jobs & Sites"]:[];
      const sharedJobNumbers=new Set(sharedJobs.map(j=>String(j.job_number||"").trim()));
      let importedLegacyJobs=false;
      for(const legacy of legacyJobs){
        const jobNumber=String(legacy["Job number"]||"").trim();
        const projectName=String(legacy["Job / project name"]||"").trim();
        if(!jobNumber||!projectName||sharedJobNumbers.has(jobNumber))continue;
        try{
          await api("/api/jobs",{method:"POST",body:JSON.stringify({
            jobNumber,projectName,client:String(legacy.Client||""),
            siteAddress:String(legacy["Site address"]||""),
            jobType:String(legacy["Job type"]||""),
            startDate:String(legacy["Start date"]||""),
            expectedFinishDate:String(legacy["Expected finish date"]||""),
            projectManager:String(legacy["Project manager"]||""),
            status:String(legacy.Status||"Enquiry"),notes:String(legacy.Notes||"")
          })});
          sharedJobNumbers.add(jobNumber);importedLegacyJobs=true;
        }catch(e){
          if(!/already exists/i.test(e.message))console.warn("Legacy job migration deferred:",jobNumber,e.message);
        }
      }
      if(importedLegacyJobs){const refreshed=await api("/api/jobs");sharedJobs=refreshed.jobs||[];}
      const permitted={
        administrator:Object.keys(moduleMap),
        office_manager:["Money","Documents","Suppliers & Materials","Job Materials","Workforce"],
        site_manager:["Plant & Equipment","Vehicles","Workforce","Health & Safety","Documents","Specialist Tooling"],
        employee:["Timesheets","Daily Reports"]
      }[currentUser.role]||[];
      for(const page of permitted){
        const module=moduleMap[page],local=Array.isArray(state[page])?state[page]:[];
        let remote=[];
        try{remote=(await api("/api/modules/"+module+"/records")).records||[]}catch(e){if(!/permission/i.test(e.message))console.warn("Shared register load:",page,e.message);continue}
        // The shared database is authoritative. Import legacy browser records only
        // when their IDs do not already exist remotely; never overwrite newer shared
        // records with a stale copy left in one staff member's browser.
        const byId=new Map();
        const remoteIds=new Set();
        remote.forEach(x=>{
          const id=String(x.id);
          remoteIds.add(id);
          byId.set(id,{...x.record,id:x.id});
        });
        for(const rec of local){
          if(!rec.id)rec.id=crypto.randomUUID();
          const id=String(rec.id);
          if(remoteIds.has(id))continue;
          const jobNumber=moduleJobNumber(rec);
          try{
            await api("/api/modules/"+module+"/records",{method:"POST",body:JSON.stringify({id:rec.id,jobNumber,record:rec})});
            byId.set(id,rec);
            remoteIds.add(id);
          }catch(e){
            console.warn("Legacy register import skipped:",page,e.message);
            byId.set(id,rec);
          }
        }
        state[page]=[...byId.values()];
      }
      originalSetItem.call(localStorage,"modifyRecordsV2",JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("modify-shared-records-loaded",{detail:state}));
    }catch(e){console.warn("Shared registers could not be synchronised:",e.message)}
    finally{syncingModules=false}
  }
  Storage.prototype.setItem=function(key,value){
    if(key==="modifyRecordsV2"&&currentUser&&!syncingModules){
      try{
        const before=JSON.parse(this.getItem(key)||"{}"),after=JSON.parse(value||"{}");
        for(const [page,module] of Object.entries(moduleMap)){
          const oldRows=Array.isArray(before[page])?before[page]:[],newRows=Array.isArray(after[page])?after[page]:[];
          const oldById=new Map(oldRows.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
          const newIds=new Set(newRows.map(x=>String(x?.id||"")).filter(Boolean));
          oldRows.forEach(row=>{if(row.id&&!newIds.has(String(row.id)))pendingModuleDeletes.push({module,id:String(row.id)})});
          newRows.forEach(row=>{
            if(!row?.id)return;
            const previous=oldById.get(String(row.id));
            if(previous&&JSON.stringify(previous)!==JSON.stringify(row)){
              const item={module,id:String(row.id),record:row,jobNumber:moduleJobNumber(row)};
              pendingModuleUpserts.set(module+":"+item.id,item);
            }
          });
        }
      }catch(e){console.warn("Could not compare register changes",e)}
    }
    originalSetItem.call(this,key,value);
    if(key==="modifyRecordsV2"&&currentUser&&!syncingModules){
      syncQueue=syncQueue.then(async()=>{
        for(const [key,item] of pendingModuleUpserts){
          await api("/api/modules/"+item.module+"/records",{method:"POST",body:JSON.stringify({id:item.id,jobNumber:item.jobNumber,record:item.record})});
          if(pendingModuleUpserts.get(key)===item)pendingModuleUpserts.delete(key);
        }
        await syncOperationalRegisters();
      }).catch(e=>console.warn("Register sync failed; unsent changes retained for retry:",e.message));
    }
  };
  let sharedJobs=[];
  async function boot(){try{let d;try{d=await api("/api/auth/me")}catch{}if(!d?.user)d=await api("/api/auth/login",{method:"POST",body:"{}"});currentUser=d.user;if(!currentUser)throw new Error("Could not open company workspace");cover.remove();accountBar();if(window.current==="Workforce Job Calendar")renderWorkforceSchedule();await syncOperationalRegisters()}catch(err){cover.style.display="grid";$("#modify-auth-error").textContent=err.message||"Could not connect. Refresh to try again."}}
  function localJobs(){try{const data=JSON.parse(localStorage.getItem("modifyRecordsV2")||"{}");return Array.isArray(data["Jobs & Sites"])?data["Jobs & Sites"]:[]}catch{return []}}
  let workforceScheduleRenderId=0;
  async function renderWorkforceSchedule(anchor=new Date()){
    const renderId=++workforceScheduleRenderId,body=$("#pagebody");
    if(!body)return;if(!currentUser){window.current="Workforce Job Calendar";body.innerHTML="<div class=\"schedule-card\">Loading your company workspace…</div>";return;}
    const canEdit=["administrator","office_manager","site_manager"].includes(currentUser.role);
    const monday=new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate());
    monday.setHours(0,0,0,0);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
    const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(d.getDate()+i);return d});
    $("#title").textContent="Workforce Job Calendar";$("#subtitle").textContent="Weekly job allocations for the whole team";$("#crumb").textContent="Workforce Job Calendar";
    const add=$("#add");if(add)add.style.display="none";
    body.innerHTML='<div id="modify-schedule"><div class="schedule-card"><div class="schedule-toolbar"><div><h2>Workforce Job Calendar</h2><p>Monday to Sunday · Select a blank day to assign a job, or select an existing job to edit it.</p><p id="schedule-range"></p></div><div class="schedule-actions"><button id="schedule-prev" type="button">← Previous</button><button id="schedule-today" class="primary" type="button">This week</button><button id="schedule-next" type="button">Next →</button><button id="schedule-assign" class="primary" type="button">Assign Job</button></div></div><div id="schedule-message" role="status" aria-live="polite"></div><div class="schedule-scroll" id="schedule-grid">Loading calendar…</div><div id="schedule-editor" class="api-item" hidden></div></div></div>';
    $("#schedule-range").textContent=dateLabel(days[0])+" – "+dateLabel(days[6]);
    $("#schedule-prev").onclick=()=>{const d=new Date(monday);d.setDate(d.getDate()-7);renderWorkforceSchedule(d)};
    $("#schedule-next").onclick=()=>{const d=new Date(monday);d.setDate(d.getDate()+7);renderWorkforceSchedule(d)};
    $("#schedule-today").onclick=()=>renderWorkforceSchedule(new Date());
    const grid=$("#schedule-grid"),message=$("#schedule-message");
    let workers=[],jobs=[],assignments=[];
    // Render the weekly grid immediately so a slow or unavailable API never
    // leaves the calendar area blank while data requests are pending.
    const placeholderHeader='<thead><tr><th class="worker-col">Worker</th>'+days.map(d=>'<th class="day-col">'+dateLabel(d)+'</th>').join("")+'</tr></thead>';
    grid.innerHTML='<table>'+placeholderHeader+'<tbody><tr><th class="worker-col">Team calendar<small>Loading allocations…</small></th>'+days.map(()=>'<td><span class="empty-slot" aria-hidden="true"></span></td>').join("")+'</tr></tbody></table>';
    try{
      const results=await Promise.allSettled([api("/api/jobs"),canEdit?api("/api/modules/workforce/records"):Promise.resolve({records:[]}),api("/api/modules/schedule/records")]);
      const loadErrors=[];
      if(results[0].status==="fulfilled")jobs=results[0].value.jobs||[];else loadErrors.push("Jobs: "+results[0].reason.message);
      workers=canEdit?(results[1].status==="fulfilled"?(results[1].value.records||[]).map(x=>({id:String(x.id),name:x.record?.["Full name"]||x.record?.name||"Unnamed worker",role:x.record?.["Job role / trade"]||x.record?.["Job role"]||"",status:x.record?.["Employment status"]||"Employed"})).filter(x=>x.name!=="Unnamed worker"&&!/left|inactive|terminated/i.test(String(x.status))):[]):[{id:String(currentUser.id),name:currentUser.name||"My schedule",role:""}];
      if(canEdit&&results[1].status==="rejected")loadErrors.push("Workforce: "+results[1].reason.message);
      if(canEdit&&!workers.length){try{const accountData=await api("/api/auth/users");workers=(accountData.users||[]).filter(u=>u.active!==0).map(u=>({id:String(u.id),name:u.name||"Team member",role:u.role||""}))}catch(e){loadErrors.push("Staff list: "+e.message)}}
      if(results[2].status==="fulfilled")assignments=(results[2].value.records||[]).map(x=>({...x.record,id:String(x.id),workerId:String(x.record?.workerId||""),jobNumber:String(x.jobNumber||x.record?.jobNumber||"")}));
      else loadErrors.push("Existing allocations: "+results[2].reason.message);
      if(renderId!==workforceScheduleRenderId||!body.isConnected)return;
      if(loadErrors.length)message.textContent="Some calendar data could not load. "+loadErrors.join(" · ");
    }catch(e){if(renderId===workforceScheduleRenderId&&grid?.isConnected){message.textContent="Calendar data is temporarily unavailable: "+e.message+" The weekly calendar is still displayed."; }return}
    const header='<thead><tr><th class="worker-col">Worker</th>'+days.map(d=>'<th class="day-col">'+dateLabel(d)+'</th>').join("")+'</tr></thead>';
    const rows=workers.map(w=>'<tr><th class="worker-col">'+esc(w.name)+(w.role?'<br><small>'+esc(w.role)+'</small>':"")+'</th>'+days.map(d=>{
      const key=dateKey(d),items=assignments.filter(a=>(a.workerId===w.id||(!canEdit&&a.workerName===w.name))&&a.date===key);
      const html=items.length?items.map(a=>'<button type="button" class="shift" data-edit-shift="'+esc(a.id)+'"><strong>'+esc(a.jobNumber||"Job")+'</strong>'+esc(a.jobName||"Project not set")+(a.startTime?' · '+esc(a.startTime):"")+'</button>').join(""):(canEdit?'<button type="button" class="empty-slot" aria-label="Assign a job to '+esc(w.name)+' on '+esc(dateLabel(d))+'" data-new-shift="'+esc(w.id)+'" data-date="'+key+'"></button>':'—');
      return '<td data-day="'+esc(dateLabel(d))+'">'+html+'</td>';
    }).join("")+'</tr>').join("");
    grid.innerHTML='<table>'+header+'<tbody>'+(rows||'<tr><td colspan="8">No active workers found in the Workforce register.</td></tr>')+'</tbody></table>';
    const editor=$("#schedule-editor");
    function openEditor(existing={},workerId="",date=dateKey(new Date())){
      if(!canEdit)return;
      const chosen=String(existing.workerId||workerId||"");
      editor.hidden=false;
      editor.innerHTML='<h3>'+(existing.id?'Edit job allocation':'Assign a job')+'</h3><div class="schedule-form"><label>Worker<select id="sch-worker">'+workers.map(w=>'<option value="'+esc(w.id)+'" '+(w.id===chosen?'selected':'')+'>'+esc(w.name)+'</option>').join("")+'</select></label><label>Job / project<select id="sch-job"><option value="">Choose a job</option>'+jobs.map(j=>'<option value="'+esc(j.job_number)+'" '+(String(j.job_number)===String(existing.jobNumber||"")?'selected':'')+'>'+esc(j.job_number+" — "+j.project_name)+'</option>').join("")+'</select></label><label>Date<input id="sch-date" type="date" value="'+esc(existing.date||date)+'" required></label><label>Start time<input id="sch-start" type="time" value="'+esc(existing.startTime||"")+'"></label><label>Finish time<input id="sch-end" type="time" value="'+esc(existing.endTime||"")+'"></label><label class="wide">Notes<textarea id="sch-notes" rows="2">'+esc(existing.notes||"")+'</textarea></label></div><div class="api-actions"><button type="button" id="sch-cancel">Cancel</button>'+(existing.id?'<button type="button" id="sch-delete">Delete allocation</button>':"")+'<button type="button" id="sch-save">Save allocation</button></div>';
      editor.scrollIntoView({behavior:"smooth",block:"start"});
      $("#sch-job").focus({preventScroll:true});
      $("#sch-cancel").onclick=()=>editor.hidden=true;
      $("#sch-save").onclick=async()=>{
        const worker=workers.find(w=>w.id===$("#sch-worker").value),job=jobs.find(j=>String(j.job_number)===$("#sch-job").value),dateValue=$("#sch-date").value,startTime=$("#sch-start").value,endTime=$("#sch-end").value;
        if(!worker||!job||!dateValue){message.textContent="Please choose a worker, job and date.";return}
        if(startTime&&endTime&&endTime<=startTime){message.textContent="Finish time must be later than start time.";return}
        const record={workerId:worker.id,workerName:worker.name,workerRole:worker.role,jobNumber:String(job.job_number),jobName:job.project_name,date:dateValue,startTime,endTime,notes:$("#sch-notes").value};
        const button=$("#sch-save");button.disabled=true;button.textContent="Saving…";
        try{await api("/api/modules/schedule/records",{method:"POST",body:JSON.stringify({id:existing.id||crypto.randomUUID(),jobNumber:String(job.job_number),record})});await renderWorkforceSchedule(new Date(dateValue+"T12:00:00"))}
        catch(e){message.textContent="Could not save allocation: "+e.message;button.disabled=false;button.textContent="Save allocation"}
      };
      if(existing.id)$("#sch-delete").onclick=async()=>{
        if(!confirm("Delete this calendar allocation?"))return;
        try{await api("/api/modules/schedule/records/"+encodeURIComponent(existing.id),{method:"DELETE"});await renderWorkforceSchedule(monday)}
        catch(e){message.textContent="Could not delete allocation: "+e.message}
      };
    }
    $("#schedule-assign").onclick=()=>{if(!canEdit){message.textContent="Your account can view the calendar but cannot assign jobs.";return}if(!workers.length){message.textContent="No workers are available to assign. Add staff in the Workforce register first.";return}if(!jobs.length){message.textContent="No jobs are available. Add a job in Jobs & Sites first.";return}openEditor({},workers[0].id,dateKey(new Date()))};
    grid.querySelectorAll("[data-new-shift]").forEach(b=>b.onclick=()=>openEditor({},b.dataset.newShift,b.dataset.date));
    grid.querySelectorAll("[data-edit-shift]").forEach(b=>b.onclick=()=>{const a=assignments.find(x=>x.id===b.dataset.editShift);if(a)openEditor(a)});
  }
  window.renderWorkforceSchedule=renderWorkforceSchedule;
  function jobsOptions(jobs){return (jobs||[]).map(j=>{const n=String(j.job_number||"");const name=String(j.project_name||"");return '<option value="'+esc(n)+'">'+esc(n+" — "+name)+'</option>'}).join("")}
  async function renderJobUpdates(jobFilter=null){
    const body=$("#pagebody");if(!body)return;
    $("#title").textContent="Job updates & site diary";$("#subtitle").textContent="Shared company updates · Manager review · Server-stored records";$("#crumb").textContent="Job Updates";
    body.innerHTML='<div id="modify-job-api"><div class="api-card"><h2>Create a job update</h2><p>Complete the selections and review before submitting.</p><div class="api-grid"><label class="api-wide">Job / project<select id="api-job"><option value="">Choose a job</option>'+jobsOptions(sharedJobs)+'</select></label><label>Work stage<select id="api-stage"><option value="">Select stage</option>'+["Groundworks","Foundations","Drainage","Structural work","Roofing","First fix","Second fix","Plastering","Finishes","External works","Handover","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Status<select id="api-status"><option value="">Select status</option>'+["Not started","In progress","Completed","On hold","Issue / delay","Inspection required"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Work carried out<select id="api-work"><option value="">Select work type</option>'+["Preparation","Installation","Repair","Inspection","Testing","Delivery","Cleaning / clearance","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Site condition / issue<select id="api-issue"><option value="">Select condition</option>'+["No issues","Access issue","Weather delay","Material shortage","Plant / equipment issue","Quality issue","Health & safety concern","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label class="api-wide">Next action<select id="api-next"><option value="">Select next action</option>'+["Continue planned works","Arrange inspection","Order materials","Resolve issue","Book subcontractor","Update programme","Prepare handover","No further action","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label class="api-wide">Notes (optional)<textarea id="api-note"></textarea></label><label class="api-wide">Site photos (JPG, PNG or WebP, max 8 MB each)<input id="api-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><div id="api-photo-preview" class="api-item">Selected photos will appear here for review.</div><small>Uploads are stored privately when the Cloudflare JOB_PHOTOS bucket is configured.</small></label></div><div class="api-actions"><button id="api-submit" type="button">Review & submit update</button></div></div><div class="api-card"><h2>Shared update history</h2><div id="api-history">Loading…</div></div></div>';
    if(jobFilter)$("#api-job").value=jobFilter;
    let photoPreviewUrls=[];$("#api-photos").addEventListener("change",()=>{photoPreviewUrls.forEach(url=>URL.revokeObjectURL(url));photoPreviewUrls=[];const files=Array.from($("#api-photos").files||[]);$("#api-photo-preview").innerHTML=files.length?files.map(f=>{const url=URL.createObjectURL(f);photoPreviewUrls.push(url);return '<div style="display:inline-grid;gap:5px;margin:6px"><img src="'+url+'" alt="'+esc(f.name)+'" style="width:110px;height:85px;object-fit:cover;border-radius:7px"><small>'+esc(f.name)+' · '+Math.ceil(f.size/1024)+' KB</small></div>'}).join(""):"No photos selected.";});
     $("#api-submit").onclick=async()=>{const v=id=>$("#api-"+id).value;const payload={jobNumber:v("job"),jobName:sharedJobs.find(j=>String(j.job_number)===v("job"))?.project_name||"",stage:v("stage"),status:v("status"),workType:v("work"),issue:v("issue"),nextAction:v("next"),note:v("note")};if(Object.entries(payload).some(([k,x])=>["jobNumber","stage","status","workType","issue","nextAction"].includes(k)&&!x)){alert("Please complete all required selections.");return}const summary="Job: "+payload.jobNumber+"\nStage: "+payload.stage+"\nStatus: "+payload.status+"\nWork: "+payload.workType+"\nIssue: "+payload.issue+"\nNext: "+payload.nextAction+"\nNotes: "+payload.note;if(!confirm("Review this update:\n\n"+summary+"\n\nSubmit for manager review?"))return;try{const created=await api("/api/job-updates",{method:"POST",body:JSON.stringify(payload)});const photos=Array.from($("#api-photos").files||[]);let photoErrors=[];for(const file of photos){if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){photoErrors.push(file.name+": use JPG, PNG or WebP up to 8 MB");continue}try{const response=await fetch("/api/job-updates/"+created.id+"/photos",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type,"X-File-Name":file.name},body:file});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Photo upload failed");}catch(e){photoErrors.push(file.name+": "+e.message)}}alert("Update submitted to the shared company system."+(photoErrors.length?"\n\nPhoto upload issue:\n"+photoErrors.join("\n"):""));await renderJobUpdates(jobFilter)}catch(err){alert(err.message)}};
    try{const d=await api("/api/job-updates");$("#api-history").innerHTML=(d.updates||[]).filter(x=>!jobFilter||String(x.job_number)===String(jobFilter)).map(x=>'<div class="api-item"><strong>'+esc(x.job_name||x.job_number)+' · '+esc(x.stage)+'</strong><br><small>'+esc(x.creator_name)+' · '+new Date(x.created_at*1000).toLocaleString()+'</small><p>'+esc(x.status)+' · '+esc(x.work_type)+' · '+esc(x.issue)+'</p><p>'+esc(x.note)+'</p>'+(x.photos||[]).map(p=>'<div style="margin:12px 0"><a href="/api/job-updates/'+esc(x.id)+'/photos/'+esc(p.id)+'" class="api-photo-link" data-photo-name="'+esc(p.file_name)+'" style="display:inline-flex;flex-direction:column;gap:6px;text-decoration:underline"><img src="/api/job-updates/'+esc(x.id)+'/photos/'+esc(p.id)+'" alt="'+esc(p.file_name)+'" loading="lazy" style="display:block;width:min(220px,100%);max-height:180px;object-fit:cover;border-radius:9px;border:1px solid #76612d"><span>'+esc(p.file_name)+' · View full image</span></a></div>').join("")+'<p><b>Review:</b> '+esc(x.review_status)+(x.review_note?' · '+esc(x.review_note):"")+'</p>'+((currentUser.role==="administrator"||currentUser.role==="office_manager"||currentUser.role==="site_manager")&&x.review_status==="pending"?'<button data-review="approved" data-id="'+esc(x.id)+'">Approve</button> <button data-review="rejected" data-id="'+esc(x.id)+'">Reject</button>':"")+'</div>').join("")||'<p>No shared updates yet.</p>';$("#api-history").addEventListener("click",e=>{const link=e.target.closest(".api-photo-link");if(!link)return;e.preventDefault();const viewer=document.createElement("div");viewer.style.cssText="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.94);display:flex;align-items:center;justify-content:center;padding:18px";viewer.innerHTML='<button type="button" aria-label="Close image" style="position:absolute;top:18px;right:18px;background:#c9a64b;color:#111;border:0;border-radius:9px;padding:12px 18px;font-weight:700">Close ✕</button><div style="max-width:100%;max-height:100%;display:flex;flex-direction:column;align-items:center;gap:10px"><img alt="" style="max-width:100%;max-height:82vh;object-fit:contain"><span style="color:white;overflow-wrap:anywhere"></span></div>';const img=viewer.querySelector("img"),caption=viewer.querySelector("span");caption.textContent=link.dataset.photoName||"Site photo";img.src=link.href;viewer.querySelector("button").onclick=()=>viewer.remove();viewer.addEventListener("click",ev=>{if(ev.target===viewer)viewer.remove()});document.body.appendChild(viewer)});$("#api-history").querySelectorAll("[data-review]").forEach(b=>b.onclick=async()=>{const note=prompt("Optional review note:")||"";try{await api("/api/job-updates/"+b.dataset.id+"/review",{method:"POST",body:JSON.stringify({decision:b.dataset.review,note})});await renderJobUpdates()}catch(e){alert(e.message)}})}catch(err){$("#api-history").textContent=err.message}
  }
  document.addEventListener("click",e=>{const b=e.target.closest('[data-page="Workforce Job Calendar"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.querySelectorAll("#nav button").forEach(x=>x.classList.toggle("active",x===b));document.querySelector("#sidebar")?.classList.remove("open");window.current="Workforce Job Calendar";renderWorkforceSchedule()},true);
  document.addEventListener("click",e=>{const b=e.target.closest('#nav button[data-page="Job Updates"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.querySelectorAll("#nav button").forEach(x=>x.classList.toggle("active",x===b));$("#sidebar")?.classList.remove("open");window.current="Job Updates";renderJobUpdates()},true);
  async function openStaffPanel(){let panel=$("#modify-staff-panel");if(panel)panel.remove();panel=document.createElement("div");panel.id="modify-staff-panel";panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h2>Staff & job assignments</h2><button id="staff-close" type="button">Close</button></div><p>Create individual staff access. PINs are never displayed again after creation.</p><div class="staffgrid"><label class="stafffield">Full name<input id="staff-name"></label><label class="stafffield">Staff code<input id="staff-code"></label><label class="stafffield">Six-digit PIN<input id="staff-pin" type="password" inputmode="numeric" maxlength="6"></label><label class="stafffield">Role<select id="staff-role"><option value="employee">Employee</option><option value="site_manager">Site manager</option><option value="office_manager">Office manager</option></select></label></div><p><button id="staff-create" type="button">Create staff account</button></p><hr><h3>Assign an employee to a job</h3><div class="staffgrid"><label class="stafffield">Employee<select id="assign-user"></select></label><label class="stafffield">Job number<input id="assign-job"></label></div><p><button id="staff-assign" type="button">Save assignment</button></p><div id="staff-list">Loading staff…</div><div id="staff-message" role="status"></div>';document.body.appendChild(panel);$("#staff-close").onclick=()=>panel.remove();if(currentUser.role!=="administrator"){$("#staff-create").disabled=true;$("#staff-create").title="Only administrator can create accounts";}if(currentUser.role!=="administrator"&&currentUser.role!=="office_manager")$("#staff-assign").style.display="none";
    const load=async()=>{try{const d=await api("/api/auth/users");$("#assign-user").innerHTML=(d.users||[]).filter(u=>u.role==="employee"&&u.active).map(u=>'<option value="'+esc(u.id)+'">'+esc(u.name)+' ('+esc(u.staffCode)+')</option>').join("");$("#staff-list").innerHTML=(d.users||[]).map(u=>'<div class="staffrow"><span><b>'+esc(u.name)+'</b><br><small>'+esc(u.staffCode)+' · '+esc(u.role)+' · '+(u.active?"Active":"Inactive")+'</small></span>'+(u.id!==currentUser.id?'<button data-toggle-user="'+esc(u.id)+'" data-active="'+(u.active?"false":"true")+'">'+(u.active?"Deactivate":"Activate")+'</button>':"")+'</div>').join("");$("#staff-list").querySelectorAll("[data-toggle-user]").forEach(b=>b.onclick=async()=>{try{await api("/api/auth/users/"+b.dataset.toggleUser,{method:"PATCH",body:JSON.stringify({active:b.dataset.active==="true"})});await load()}catch(e){alert(e.message)}})}catch(e){$("#staff-list").textContent=e.message}};
    $("#staff-create").onclick=async()=>{try{await api("/api/auth/users",{method:"POST",body:JSON.stringify({name:$("#staff-name").value,staffCode:$("#staff-code").value,pin:$("#staff-pin").value,role:$("#staff-role").value})});$("#staff-message").textContent="Staff account created. Give the staff code and PIN to the employee securely.";$("#staff-name").value=$("#staff-code").value=$("#staff-pin").value="";await load()}catch(e){$("#staff-message").textContent=e.message}};
    $("#staff-assign").onclick=async()=>{try{await api("/api/job-assignments",{method:"POST",body:JSON.stringify({userId:$("#assign-user").value,jobNumber:$("#assign-job").value})});$("#staff-message").textContent="Job assignment saved.";$("#assign-job").value=""}catch(e){$("#staff-message").textContent=e.message}};await load();
  }

  async function renderJobs(){
    const body=$("#pagebody");if(!body)return;
    $("#title").textContent="Jobs & Sites";$("#subtitle").textContent="Central job register · Shared across the company · All site activity linked to each job";$("#crumb").textContent="Jobs & Sites";$("#add").style.display="none";
    body.innerHTML='<div id="modify-job-api"><div class="api-card"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h2>Company job register</h2><p>These jobs are stored centrally and are available to authorised staff on any device.</p></div><button id="job-new" type="button">＋ Create job</button></div><p id="job-msg" role="status"></p><div id="job-list">Loading jobs…</div></div><div class="api-card" id="job-form-card" hidden></div></div>';
    const list=$("#job-list");
    async function load(){
      try{
        const d=await api("/api/jobs");
        list.innerHTML=(d.jobs||[]).map(j=>'<div class="api-item"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><strong>'+esc(j.job_number)+' · '+esc(j.project_name)+'</strong><br><small>'+esc(j.client)+' · '+esc(j.site_address)+'</small><p>'+esc(j.status)+' · Manager: '+esc(j.project_manager||"Not assigned")+'</p></div><div><button type="button" data-open-job="'+esc(j.job_number)+'">Open job</button> <button type="button" data-edit-job="'+esc(j.job_number)+'">Edit</button></div></div></div>').join("")||'<p>No shared jobs have been created yet.</p>';
        list.querySelectorAll("[data-open-job]").forEach(b=>b.onclick=()=>openJob(b.dataset.openJob));
        list.querySelectorAll("[data-edit-job]").forEach(b=>b.onclick=()=>editJob(b.dataset.editJob,d.jobs));
      }catch(e){list.textContent=e.message}
    }
    function form(job={}){
      const card=$("#job-form-card");card.hidden=false;
      const fields=[["jobNumber","Job number",job.job_number||"",!job.job_number],["projectName","Project name",job.project_name||"",true],["client","Client",job.client||""],["siteAddress","Site address",job.site_address||""],["jobType","Job type",job.job_type||""],["startDate","Start date",job.start_date||"","date"],["expectedFinishDate","Expected finish",job.expected_finish_date||"","date"],["projectManager","Project manager",job.project_manager||""],["notes","Job notes",job.notes||"","textarea"]];
      card.innerHTML='<h2>'+(job.job_number?'Edit job':'Create new job')+'</h2><div class="api-grid">'+fields.map(([id,label,value,required])=>'<label class="'+(id==="siteAddress"||id==="notes"?'api-wide':'')+'">'+label+(required===true?' *':'')+(required==="date"?'':'')+(id==="notes"?'<textarea id="job-'+id+'">'+esc(value)+'</textarea>':'<input id="job-'+id+'" '+(required===true?'required ':'')+'type="'+(required==="date"?'date':'text')+'" value="'+esc(value)+'" '+(job.job_number&&id==="jobNumber"?'readonly':'')+'>')+'</label>').join("")+'<label>Status<select id="job-status">'+["Enquiry","Quoting","Won","Scheduled","Ready to start","In progress","On hold","Complete","Cancelled"].map(x=>'<option '+(x===(job.status||"Enquiry")?'selected':'')+'>'+x+'</option>').join("")+'</select></label></div><div class="api-actions"><button id="job-cancel" type="button">Cancel</button><button id="job-save" type="button">Save job</button></div>';
      $("#job-cancel").onclick=()=>card.hidden=true;
      $("#job-save").onclick=async()=>{
        const value=id=>$("#job-"+id)?.value||"";
        const payload={jobNumber:value("jobNumber"),projectName:value("projectName"),client:value("client"),siteAddress:value("siteAddress"),jobType:value("jobType"),startDate:value("startDate"),expectedFinishDate:value("expectedFinishDate"),projectManager:value("projectManager"),status:$("#job-status").value,notes:value("notes")};
        if(!payload.jobNumber.trim()||!payload.projectName.trim()){alert("Enter a job number and project name.");return}
        try{await api(job.job_number?"/api/jobs/"+encodeURIComponent(job.job_number):"/api/jobs",{method:job.job_number?"PATCH":"POST",body:JSON.stringify(job.job_number?Object.fromEntries(Object.entries(payload).filter(([k])=>k!=="jobNumber")):payload)});card.hidden=true;$("#job-msg").textContent="Job saved to the shared company register.";await load()}catch(e){alert(e.message)}
      };
    }
    async function editJob(n,jobs){const j=jobs.find(x=>x.job_number===n);if(j)form(j)}
    async function openJob(n){
      try{
        const d=await api("/api/jobs/"+encodeURIComponent(n)),j=d.job;
        body.innerHTML='<div id="modify-job-api"><div class="api-card"><button id="jobs-back" type="button">← All jobs</button><h2>'+esc(j.job_number)+' · '+esc(j.project_name)+'</h2><p>'+esc(j.client)+' · '+esc(j.site_address)+'</p><p><b>Status:</b> '+esc(j.status)+' · <b>Project manager:</b> '+esc(j.project_manager||"Not assigned")+'</p><p>'+esc(j.notes)+'</p><div class="api-actions"><button id="job-diary" type="button">＋ Add / view site updates</button></div></div><div class="api-card"><h3>Assigned staff</h3>'+(d.assignments||[]).map(a=>'<p>'+esc(a.full_name)+' · '+esc(a.staff_code)+'</p>').join("")+'<p><small>Managers can add assignments from Staff & assignments.</small></p></div><div class="api-card"><h3>Linked job records</h3><p><small>Materials, money, workforce, plant, vehicles, safety and documents recorded against this job.</small></p>'+(d.records||[]).map(r=>'<div class="api-item"><b>'+esc(r.module.replaceAll("_"," "))+'</b><p>'+Object.entries(r.record||{}).filter(([k,v])=>v!==""&&v!==null&&v!==undefined&&k!=="attachments").slice(0,12).map(([k,v])=>esc(k)+': '+esc(typeof v==="object"?JSON.stringify(v):v)).join(' · ')+'</p></div>').join("")||'<p>No linked operational records for this job yet.</p>'+'</div><div class="api-card"><h3>Progress and site diary</h3><div id="job-detail-updates">'+(d.updates||[]).map(u=>'<div class="api-item"><b>'+esc(u.stage)+' · '+esc(u.status)+'</b><br><small>'+esc(u.creator_name)+' · '+new Date(u.created_at*1000).toLocaleString()+'</small><p>'+esc(u.work_type)+' · '+esc(u.issue)+' · '+esc(u.next_action)+'</p><p>'+esc(u.note)+'</p><p>Review: '+esc(u.review_status)+'</p></div>').join("")||'<p>No updates recorded for this job yet.</p>'+'</div></div></div>';
        $("#jobs-back").onclick=renderJobs;$("#job-diary").onclick=()=>renderJobUpdates(n);
      }catch(e){alert(e.message)}
    }
    $("#job-new").onclick=()=>form();
    await load();
    // One-time import of this browser's old job register into the central database.
    const old=localJobs();
    if(old.length){
      const note=document.createElement("p");note.innerHTML='<small>Found '+old.length+' older job record(s) saved on this device. <button id="job-import" type="button">Import missing jobs into shared register</button></small>';$("#job-msg").appendChild(note);
      $("#job-import").onclick=async()=>{let count=0;for(const j of old){const jobNumber=String(j["Job number"]||"").trim();const projectName=String(j["Job / project name"]||"").trim();if(!jobNumber||!projectName)continue;try{await api("/api/jobs",{method:"POST",body:JSON.stringify({jobNumber,projectName,client:j.Client||"",siteAddress:j["Site address"]||"",jobType:j["Job type"]||"",startDate:j["Start date"]||"",expectedFinishDate:j["Expected finish date"]||"",projectManager:j["Project manager"]||"",status:j.Status||"Enquiry",notes:j.Notes||""})});count++}catch(e){if(!e.message.toLowerCase().includes("already exists"))console.warn("Job import skipped",jobNumber,e)}}$("#job-msg").textContent=count+" job(s) imported. Existing job numbers were left unchanged.";await load()};
    }
  }
  document.addEventListener("click",e=>{
    const b=e.target.closest('#nav button[data-page="Jobs & Sites"]');if(!b)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    document.querySelectorAll("#nav button").forEach(x=>x.classList.toggle("active",x===b));$("#sidebar")?.classList.remove("open");renderJobs();
  },true);
  const originalRenderV2=window.renderV2;
  if(typeof originalRenderV2==="function"){
    window.renderV2=function(){
      if($("#crumb")?.textContent==="Job Updates"){renderJobUpdates();return} if($("#crumb")?.textContent==="Jobs & Sites"){renderJobs();return}
      return originalRenderV2.apply(this,arguments);
    };
  }

  // Add a direct link from each job's existing detail record to its shared site diary.
  const pageBody=$("#pagebody");
  if(pageBody){
    const attachJobUpdates=()=>{
      if($("#crumb")?.textContent!=="Jobs & Sites" || !pageBody.querySelector(".profile-card"))return;
      const profile=pageBody.querySelector(".profile-card");
      if(profile.querySelector("[data-open-job-updates]"))return;
      const fields=[...profile.querySelectorAll(".profile-field")];
      const field=fields.find(f=>f.querySelector("small")?.textContent.trim().toLowerCase().startsWith("job number"));
      const jobNumber=field?.querySelector("div")?.textContent.trim();
      if(!jobNumber)return;
      const button=document.createElement("button");
      button.type="button";button.dataset.openJobUpdates="";button.className="btn primary";
      button.textContent="View job updates & site diary";
      button.addEventListener("click",()=>renderJobUpdates(jobNumber));
      const actions=profile.querySelector(".profile-actions")||profile.querySelector(".profile-heading");
      if(actions)actions.appendChild(button);else profile.prepend(button);
    };
    new MutationObserver(attachJobUpdates).observe(pageBody,{childList:true,subtree:true});
    attachJobUpdates();
  }
  boot();
})();