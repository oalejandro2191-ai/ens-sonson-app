export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>
    {children}
    <style>{`
      .nav-button{width:100%;border:0;background:transparent;text-align:left;cursor:pointer}
      .admin-feedback{margin-bottom:16px}
      .admin-workspace{display:grid;gap:18px}
      .admin-editor{padding:24px;display:grid;gap:18px}
      .section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .section-heading h2{margin:6px 0 0;font-size:28px}
      .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .form-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}
      .form-grid label{display:grid;gap:7px;color:var(--muted);font-size:12px;font-weight:800}
      .form-grid input,.form-grid select,.admin-toolbar input,.admin-toolbar select,.student-group-control select{min-height:44px;border:1px solid #cdd9d2;border-radius:11px;padding:8px 11px;background:white;color:var(--ink);outline:none}
      .form-grid input:focus,.form-grid select:focus,.admin-toolbar input:focus,.admin-toolbar select:focus,.student-group-control select:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(23,106,69,.10)}
      .admin-card-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .management-card{padding:20px;display:grid;gap:16px}
      .management-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
      .management-card h3,.student-row h3,.temporary-access h3{margin:0}
      .management-card p,.student-row p,.temporary-access p{margin:5px 0 0;color:var(--muted);line-height:1.45}
      .management-metrics{display:flex;gap:14px;flex-wrap:wrap;color:var(--muted);font-size:13px}
      .management-metrics strong{color:var(--green-dark)}
      .management-actions{display:flex;gap:8px;flex-wrap:wrap}
      .danger-button{border:1px solid #edc9c9;background:#fff3f3;color:#963535;border-radius:12px;min-height:44px;padding:0 14px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:7px}
      .danger-button:hover{background:#ffeaea}
      .status-pill{display:inline-flex;align-items:center;width:max-content;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;background:#eef2ef;color:#526158}
      .status-pill.active{background:#e9f7ef;color:#176a45}
      .status-pill.pending_activation{background:#fff7d8;color:#735c08}
      .status-pill.suspended{background:#fff1df;color:#8a5314}
      .status-pill.archived{background:#f1f1f1;color:#666}
      .status-pill.unpublished{background:#eef0fa;color:#45508a}
      .admin-toolbar{padding:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
      .search-field{display:flex;align-items:center;gap:8px;min-width:min(390px,100%);flex:1;border:1px solid #cdd9d2;border-radius:11px;padding-left:12px;background:white;color:var(--muted)}
      .search-field input{border:0;box-shadow:none!important;flex:1;min-width:100px}
      .toolbar-count{margin-left:auto;color:var(--muted);font-size:12px;font-weight:800}
      .admin-list{display:grid;gap:10px}
      .student-row{padding:18px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center}
      .student-main{display:flex;gap:13px;align-items:flex-start;min-width:0}
      .avatar-small{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#edf6f1;color:var(--green);flex:0 0 auto}
      .inline-stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px;color:var(--muted);font-size:11px}
      .inline-stats strong{color:var(--green-dark)}
      .student-side{display:grid;gap:9px;justify-items:end;max-width:520px}
      .student-side small{color:var(--muted)}
      .student-group-control{display:flex;gap:7px;align-items:center}
      .student-group-control select{min-width:170px}
      .compact{min-height:40px;padding:0 11px}
      .temporary-access{padding:20px;display:flex;justify-content:space-between;align-items:center;gap:20px;border-color:#e4b82f;background:#fffdf4}
      .temporary-access code{display:inline-block;margin-top:10px;padding:10px 13px;border-radius:10px;background:#16261e;color:#fff;font-size:18px;letter-spacing:.04em}
      .vocabulary-table{overflow:hidden}
      .table-head,.table-row{display:grid;grid-template-columns:1.35fr .9fr 1fr .6fr .8fr;gap:12px;align-items:center;padding:13px 16px}
      .table-head{background:#f1f5f2;color:var(--muted);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}
      .table-row{border-top:1px solid var(--line);font-size:13px}
      .table-row>div{min-width:0}
      .table-row strong,.table-row span,.table-row small{display:block}
      .table-row small{color:var(--muted);margin-top:3px;word-break:break-word}
      .table-actions{display:flex;gap:6px;justify-content:flex-end}
      .danger-icon{color:#963535}
      .audit-panel{padding:24px}
      .audit-list{display:grid;margin-top:16px}
      .audit-list article{display:flex;justify-content:space-between;gap:18px;padding:13px 0;border-top:1px solid var(--line)}
      .audit-list strong,.audit-list span{display:block}
      .audit-list span,.audit-list small{color:var(--muted);font-size:11px;margin-top:3px}
      @media(max-width:1050px){.admin-card-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid.three{grid-template-columns:repeat(2,minmax(0,1fr))}.table-head{display:none}.table-row{grid-template-columns:1fr 1fr}.table-actions{justify-content:flex-start}}
      @media(max-width:720px){.admin-card-grid,.form-grid,.form-grid.three{grid-template-columns:1fr}.student-row{grid-template-columns:1fr}.student-side{justify-items:start;max-width:none}.student-group-control{width:100%}.student-group-control select{flex:1;min-width:0}.temporary-access{align-items:flex-start;flex-direction:column}.table-row{grid-template-columns:1fr}.toolbar-count{width:100%;margin-left:0}}
    `}</style>
  </>;
}
