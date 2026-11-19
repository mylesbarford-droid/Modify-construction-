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
  @media(max-width:600px){#modify-staff-panel .staffgrid,#modify-job-api .api-grid{grid-template-columns:1fr}#modify-job-api .api-wide{grid-column:auto}#modify-staff-panel{inset:3% 3%}}
  `;
  const style=document.createElement("style");style.textContent=css;document.head.appendChild(style);
  const cover=document.createElement("div");cover.id="modify-auth-cover";cover.innerHTML='<div class="authbox"><img class="auth-logo" src="/logo.svg" alt="MODIFY Construction"><p>Opening company workspace…</p><div id="modify-auth-error" role="alert"></div></div>';
  document.body.appendChild(cover);
  const api=async(path,opts={})=>{const r=await fetch(path,{credentials:"same-origin",...opts,headers:{...(opts.body instanceof FormData?{}:{"content-type":"application/json"}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed ("+r.status+")");return data};
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
  async function boot(){try{let d;try{d=await api("/api/auth/me")}catch{}if(!d?.user)d=await api("/api/auth/login",{method:"POST",body:"{}"});currentUser=d.user;if(!currentUser)throw new Error("Could not open company workspace");cover.remove();accountBar();await syncOperationalRegisters()}catch(err){cover.style.display="grid";$("#modify-auth-error").textContent=err.message||"Could not connect. Refresh to try again."}}
  function localJobs(){try{const data=JSON.parse(localStorage.getItem("modifyRecordsV2")||"{}");return Array.isArray(data["Jobs & Sites"])?data["Jobs & Sites"]:[]}catch{return []}}
  function jobsOptions(jobs){return (jobs||[]).map(j=>{const n=String(j.job_number||"");const name=String(j.project_name||"");return '<option value="'+esc(n)+'">'+esc(n+" — "+name)+'</option>'}).join("")}
  async function renderJobUpdates(jobFilter=null){
    const body=$("#pagebody");if(!body)return;
    $("#title").textContent="Job updates & site diary";$("#subtitle").textContent="Shared company updates · Manager review · Server-stored records";$("#crumb").textContent="Job Updates";
    body.innerHTML='<div id="modify-job-api"><div class="api-card"><h2>Create a job update</h2><p>Complete the selections and review before submitting.</p><div class="api-grid"><label class="api-wide">Job / project<select id="api-job"><option value="">Choose a job</option>'+jobsOptions(sharedJobs)+'</select></label><label>Work stage<select id="api-stage"><option value="">Select stage</option>'+["Groundworks","Foundations","Drainage","Structural work","Roofing","First fix","Second fix","Plastering","Finishes","External works","Handover","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Status<select id="api-status"><option value="">Select status</option>'+["Not started","In progress","Completed","On hold","Issue / delay","Inspection required"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Work carried out<select id="api-work"><option value="">Select work type</option>'+["Preparation","Installation","Repair","Inspection","Testing","Delivery","Cleaning / clearance","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Site condition / issue<select id="api-issue"><option value="">Select condition</option>'+["No issues","Access issue","Weather delay","Material shortage","Plant / equipment issue","Quality issue","Health & safety concern","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label class="api-wide">Next action<select id="api-next"><option value="">Select next action</option>'+["Continue planned works","Arrange inspection","Order materials","Resolve issue","Book subcontractor","Update programme","Prepare handover","No further action","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label class="api-wide">Notes (optional)<textarea id="api-note"></textarea></label><label class="api-wide">Site photos (JPG, PNG or WebP, max 8 MB each)<input id="api-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><div id="api-photo-preview" class="api-item">Selected photos will appear here for review.</div><small>Uploads are stored privately when the Cloudflare JOB_PHOTOS bucket is configured.</small></label></div><div class="api-actions"><button id="api-submit" type="button">Review & submit update</button></div></div><div class="api-card"><h2>Shared update history</h2><div id="api-history">Loading…</div></div></div>';
    if(jobFilter)$("#api-job").value=jobFilter;
    let photoPreviewUrls=[];$("#api-photos").addEventListener("change",()=>{photoPreviewUrls.forEach(url=>URL.revokeObjectURL(url));photoPreviewUrls=[];const files=Array.from($("#api-photos").files||[]);$("#api-photo-preview").innerHTML=files.length?files.map(f=>{const url=URL.createObjectURL(f);photoPreviewUrls.push(url);return '<div style="display:inline-grid;gap:5px;margin:6px"><img src="'+url+'" alt="'+esc(f.name)+'" style="width:110px;height:85px;object-fit:cover;border-radius:7px"><small>'+esc(f.name)+' · '+Math.ceil(f.size/1024)+' KB</small></div>'}).join(""):"No photos selected.";});
     $("#api-submit").onclick=async()=>{const v=id=>$("#api-"+id).value;const payload={jobNumber:v("job"),jobName:sharedJobs.find(j=>String(j.job_number)===v("job"))?.project_name||"",stage:v("stage"),status:v("status"),workType:v("work"),issue:v("issue"),nextAction:v("next"),note:v("note")};if(Object.entries(payload).some(([k,x])=>["jobNumber","stage","status","workType","issue","nextAction"].includes(k)&&!x)){alert("Please complete all required selections.");return}const summary="Job: "+payload.jobNumber+"\nStage: "+payload.stage+"\nStatus: "+payload.status+"\nWork: "+payload.workType+"\nIssue: "+payload.issue+"\nNext: "+payload.nextAction+"\nNotes: "+payload.note;if(!confirm("Review this update:\n\n"+summary+"\n\nSubmit for manager review?"))return;try{const created=await api("/api/job-updates",{method:"POST",body:JSON.stringify(payload)});const photos=Array.from($("#api-photos").files||[]);let photoErrors=[];for(const file of photos){if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){photoErrors.push(file.name+": use JPG, PNG or WebP up to 8 MB");continue}try{const response=await fetch("/api/job-updates/"+created.id+"/photos",{method:"POST",credentials:"same-origin",headers:{"Content-Type":file.type,"X-File-Name":file.name},body:file});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Photo upload failed");}catch(e){photoErrors.push(file.name+": "+e.message)}}alert("Update submitted to the shared company system."+(photoErrors.length?"\n\nPhoto upload issue:\n"+photoErrors.join("\n"):""));await renderJobUpdates(jobFilter)}catch(err){alert(err.message)}};
    try{const d=await api("/api/job-updates");$("#api-history").innerHTML=(d.updates||[]).filter(x=>!jobFilter||String(x.job_number)===String(jobFilter)).map(x=>'<div class="api-item"><strong>'+esc(x.job_name||x.job_number)+' · '+esc(x.stage)+'</strong><br><small>'+esc(x.creator_name)+' · '+new Date(x.created_at*1000).toLocaleString()+'</small><p>'+esc(x.status)+' · '+esc(x.work_type)+' · '+esc(x.issue)+'</p><p>'+esc(x.note)+'</p>'+(x.photos||[]).map(p=>'<p><a target="_blank" rel="noopener" href="/api/job-updates/'+esc(x.id)+'/photos/'+esc(p.id)+'">'+esc(p.file_name)+'</a></p>').join("")+'<p><b>Review:</b> '+esc(x.review_status)+(x.review_note?' · '+esc(x.review_note):"")+'</p>'+((currentUser.role==="administrator"||currentUser.role==="office_manager"||currentUser.role==="site_manager")&&x.review_status==="pending"?'<button data-review="approved" data-id="'+esc(x.id)+'">Approve</button> <button data-review="rejected" data-id="'+esc(x.id)+'">Reject</button>':"")+'</div>').join("")||'<p>No shared updates yet.</p>';$("#api-history").querySelectorAll("[data-review]").forEach(b=>b.onclick=async()=>{const note=prompt("Optional review note:")||"";try{await api("/api/job-updates/"+b.dataset.id+"/review",{method:"POST",body:JSON.stringify({decision:b.dataset.review,note})});await renderJobUpdates()}catch(e){alert(e.message)}})}catch(err){$("#api-history").textContent=err.message}
  }
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