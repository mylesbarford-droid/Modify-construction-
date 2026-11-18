(()=> {
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let currentUser=null;
  const css=`
  #modify-auth-cover{position:fixed;inset:0;z-index:10000;background:#090a0c;color:#f5f1e7;display:grid;place-items:center;padding:20px;font-family:system-ui,sans-serif}
  #modify-auth-cover .authbox{width:min(420px,100%);background:#1a1c20;border:1px solid #c6a34a;border-radius:16px;padding:25px;box-shadow:0 20px 70px #0009}
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
  const cover=document.createElement("div");cover.id="modify-auth-cover";cover.innerHTML='<form class="authbox" id="modify-login-form"><h1>MODIFY Construction</h1><p>Company sign-in · Staff access</p><label>Company password</label><input name="companyPassword" type="password" autocomplete="current-password" required><label>Staff code</label><input name="staffCode" autocomplete="username" required><label>Personal 6-digit PIN</label><input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="current-password" required><div id="modify-auth-error" role="alert"></div><button type="submit">Sign in</button></form>';
  document.body.appendChild(cover);
  const api=async(path,opts={})=>{const r=await fetch(path,{credentials:"same-origin",...opts,headers:{...(opts.body instanceof FormData?{}:{"content-type":"application/json"}),...(opts.headers||{})}});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"Request failed ("+r.status+")");return data};
  function accountBar(){let bar=$("#modify-account");if(!bar){bar=document.createElement("div");bar.id="modify-account";const top=$(".top");if(top)top.appendChild(bar)}if(bar)bar.innerHTML='<span>'+esc(currentUser.name)+' · '+esc(currentUser.role.replaceAll("_"," "))+'</span><button id="modify-staff-open" type="button">Staff & assignments</button><button id="modify-logout" type="button">Sign out</button>';const staff=$("#modify-staff-open");if(staff)staff.style.display=currentUser.role==="administrator"||currentUser.role==="office_manager"?"":"none";$("#modify-logout")?.addEventListener("click",async()=>{try{await api("/api/auth/logout",{method:"POST"})}catch{}location.reload()});staff?.addEventListener("click",openStaffPanel)}
  async function boot(){try{const d=await api("/api/auth/me");currentUser=d.user;if(!currentUser)throw new Error("Please sign in");cover.remove();accountBar()}catch{cover.style.display="grid"}}
  $("#modify-login-form").addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const error=$("#modify-auth-error");error.textContent="Signing in…";try{const d=await api("/api/auth/login",{method:"POST",body:JSON.stringify({companyPassword:f.get("companyPassword"),staffCode:f.get("staffCode"),pin:f.get("pin")})});currentUser=d.user;cover.remove();accountBar();location.reload()}catch(err){error.textContent=err.message}});
  function localJobs(){try{const data=JSON.parse(localStorage.getItem("modifyRecordsV2")||"{}");return Array.isArray(data["Jobs & Sites"])?data["Jobs & Sites"]:[]}catch{return []}}
  function jobsOptions(){return localJobs().map(j=>{const n=String(j["Job number"]||"");const name=String(j["Job / project name"]||"");return '<option value="'+esc(n)+'">'+esc(n+" — "+name)+'</option>'}).join("")}
  async function renderJobUpdates(jobFilter=null){
    const body=$("#pagebody");if(!body)return;
    $("#title").textContent="Job updates & site diary";$("#subtitle").textContent="Shared company updates · Manager review · Server-stored records";$("#crumb").textContent="Job Updates";
    body.innerHTML='<div id="modify-job-api"><div class="api-card"><h2>Create a job update</h2><p>Complete the selections and review before submitting.</p><div class="api-grid"><label class="api-wide">Job / project<select id="api-job"><option value="">Choose a job</option>'+jobsOptions()+'</select></label><label>Work stage<select id="api-stage"><option value="">Select stage</option>'+["Groundworks","Foundations","Drainage","Structural work","Roofing","First fix","Second fix","Plastering","Finishes","External works","Handover","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Status<select id="api-status"><option value="">Select status</option>'+["Not started","In progress","Completed","On hold","Issue / delay","Inspection required"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Work carried out<select id="api-work"><option value="">Select work type</option>'+["Preparation","Installation","Repair","Inspection","Testing","Delivery","Cleaning / clearance","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label>Site condition / issue<select id="api-issue"><option value="">Select condition</option>'+["No issues","Access issue","Weather delay","Material shortage","Plant / equipment issue","Quality issue","Health & safety concern","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label class="api-wide">Next action<select id="api-next"><option value="">Select next action</option>'+["Continue planned works","Arrange inspection","Order materials","Resolve issue","Book subcontractor","Update programme","Prepare handover","No further action","Other"].map(x=>'<option>'+x+'</option>').join("")+'</select></label><label class="api-wide">Notes (optional)<textarea id="api-note"></textarea></label><label class="api-wide">Site photos<p>Private photo storage is not yet connected. Photo uploads are temporarily unavailable; no photos will be saved to an individual browser.</p></label></div><div class="api-actions"><button id="api-submit" type="button">Review & submit update</button></div></div><div class="api-card"><h2>Shared update history</h2><div id="api-history">Loading…</div></div></div>';
    $("#api-submit").onclick=async()=>{const v=id=>$("#api-"+id).value;const payload={jobNumber:v("job"),jobName:localJobs().find(j=>String(j["Job number"]||"")===v("job"))?.["Job / project name"]||"",stage:v("stage"),status:v("status"),workType:v("work"),issue:v("issue"),nextAction:v("next"),note:v("note")};if(Object.entries(payload).some(([k,x])=>["jobNumber","stage","status","workType","issue","nextAction"].includes(k)&&!x)){alert("Please complete all required selections.");return}const summary="Job: "+payload.jobNumber+"\nStage: "+payload.stage+"\nStatus: "+payload.status+"\nWork: "+payload.workType+"\nIssue: "+payload.issue+"\nNext: "+payload.nextAction+"\nNotes: "+payload.note;if(!confirm("Review this update:\n\n"+summary+"\n\nSubmit for manager review?"))return;try{await api("/api/job-updates",{method:"POST",body:JSON.stringify(payload)});alert("Update submitted to the shared company system.");await renderJobUpdates()}catch(err){alert(err.message)}};
    try{const d=await api("/api/job-updates");$("#api-history").innerHTML=(d.updates||[]).filter(x=>!jobFilter||String(x.job_number)===String(jobFilter)).map(x=>'<div class="api-item"><strong>'+esc(x.job_name||x.job_number)+' · '+esc(x.stage)+'</strong><br><small>'+esc(x.creator_name)+' · '+new Date(x.created_at*1000).toLocaleString()+'</small><p>'+esc(x.status)+' · '+esc(x.work_type)+' · '+esc(x.issue)+'</p><p>'+esc(x.note)+'</p><p><b>Review:</b> '+esc(x.review_status)+(x.review_note?' · '+esc(x.review_note):"")+'</p>'+((currentUser.role==="administrator"||currentUser.role==="office_manager"||currentUser.role==="site_manager")&&x.review_status==="pending"?'<button data-review="approved" data-id="'+esc(x.id)+'">Approve</button> <button data-review="rejected" data-id="'+esc(x.id)+'">Reject</button>':"")+'</div>').join("")||'<p>No shared updates yet.</p>';$("#api-history").querySelectorAll("[data-review]").forEach(b=>b.onclick=async()=>{const note=prompt("Optional review note:")||"";try{await api("/api/job-updates/"+b.dataset.id+"/review",{method:"POST",body:JSON.stringify({decision:b.dataset.review,note})});await renderJobUpdates()}catch(e){alert(e.message)}})}catch(err){$("#api-history").textContent=err.message}
  }
  document.addEventListener("click",e=>{const b=e.target.closest('#nav button[data-page="Job Updates"]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.querySelectorAll("#nav button").forEach(x=>x.classList.toggle("active",x===b));$("#sidebar")?.classList.remove("open");window.current="Job Updates";renderJobUpdates()},true);
  async function openStaffPanel(){let panel=$("#modify-staff-panel");if(panel)panel.remove();panel=document.createElement("div");panel.id="modify-staff-panel";panel.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><h2>Staff & job assignments</h2><button id="staff-close" type="button">Close</button></div><p>Create individual staff access. PINs are never displayed again after creation.</p><div class="staffgrid"><label class="stafffield">Full name<input id="staff-name"></label><label class="stafffield">Staff code<input id="staff-code"></label><label class="stafffield">Six-digit PIN<input id="staff-pin" type="password" inputmode="numeric" maxlength="6"></label><label class="stafffield">Role<select id="staff-role"><option value="employee">Employee</option><option value="site_manager">Site manager</option><option value="office_manager">Office manager</option></select></label></div><p><button id="staff-create" type="button">Create staff account</button></p><hr><h3>Assign an employee to a job</h3><div class="staffgrid"><label class="stafffield">Employee<select id="assign-user"></select></label><label class="stafffield">Job number<input id="assign-job"></label></div><p><button id="staff-assign" type="button">Save assignment</button></p><div id="staff-list">Loading staff…</div><div id="staff-message" role="status"></div>';document.body.appendChild(panel);$("#staff-close").onclick=()=>panel.remove();if(currentUser.role!=="administrator"){$("#staff-create").disabled=true;$("#staff-create").title="Only administrator can create accounts";}if(currentUser.role!=="administrator"&&currentUser.role!=="office_manager")$("#staff-assign").style.display="none";
    const load=async()=>{try{const d=await api("/api/auth/users");$("#assign-user").innerHTML=(d.users||[]).filter(u=>u.role==="employee"&&u.active).map(u=>'<option value="'+esc(u.id)+'">'+esc(u.name)+' ('+esc(u.staffCode)+')</option>').join("");$("#staff-list").innerHTML=(d.users||[]).map(u=>'<div class="staffrow"><span><b>'+esc(u.name)+'</b><br><small>'+esc(u.staffCode)+' · '+esc(u.role)+' · '+(u.active?"Active":"Inactive")+'</small></span>'+(u.id!==currentUser.id?'<button data-toggle-user="'+esc(u.id)+'" data-active="'+(u.active?"false":"true")+'">'+(u.active?"Deactivate":"Activate")+'</button>':"")+'</div>').join("");$("#staff-list").querySelectorAll("[data-toggle-user]").forEach(b=>b.onclick=async()=>{try{await api("/api/auth/users/"+b.dataset.toggleUser,{method:"PATCH",body:JSON.stringify({active:b.dataset.active==="true"})});await load()}catch(e){alert(e.message)}})}catch(e){$("#staff-list").textContent=e.message}};
    $("#staff-create").onclick=async()=>{try{await api("/api/auth/users",{method:"POST",body:JSON.stringify({name:$("#staff-name").value,staffCode:$("#staff-code").value,pin:$("#staff-pin").value,role:$("#staff-role").value})});$("#staff-message").textContent="Staff account created. Give the staff code and PIN to the employee securely.";$("#staff-name").value=$("#staff-code").value=$("#staff-pin").value="";await load()}catch(e){$("#staff-message").textContent=e.message}};
    $("#staff-assign").onclick=async()=>{try{await api("/api/job-assignments",{method:"POST",body:JSON.stringify({userId:$("#assign-user").value,jobNumber:$("#assign-job").value})});$("#staff-message").textContent="Job assignment saved.";$("#assign-job").value=""}catch(e){$("#staff-message").textContent=e.message}};await load();
  }
  const originalRenderV2=window.renderV2;
  if(typeof originalRenderV2==="function"){
    window.renderV2=function(){
      if($("#crumb")?.textContent==="Job Updates"){renderJobUpdates();return}
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