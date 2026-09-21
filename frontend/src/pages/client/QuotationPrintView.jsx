import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const CO = {
  name:'Livetake Productions Photo and Video Services',
  phone1:'0906 8642 868', phone2:'0939 1423 567',
  bir:'1RC0001344118', dti:'1170472',
  address:'Block E11 Lot 10, San Lorenzo 1, City of Dasmariñas, Cavite',
  email:'livetakeproductions@gmail.com', fb:'facebook.com/livetakeproductions',
  manager:'DEO ANGELO G. SAIQUE', managerTitle:'Livetake Productions, Operations Manager',
};

const fd = (d) => d ? new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'}) : '—';
const fm = (n) => (n||n===0) ? '₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:2,maximumFractionDigits:2}) : '—';

const TERMS = [
  ['Purpose','This agreement contains the entire understanding between Livetake Productions and the Client. It supersedes all prior and simultaneous agreements between the parties. The only way to add or change this agreement is to do so in writing, signed by both parties.'],
  ['Reservations','Upon your signature or reservation deposit, Livetake Productions will reserve the time and date agreed upon. The Reservation Deposit is non-refundable even if the date is changed or the event is canceled for any reason, including but not limited to acts of God, fire, strike, and extreme weather.'],
  ['Pre-Event Consultation','The parties agree to a pre-event consultation before the event to finalize the actual shooting times, locations, and the Client\'s request list (in writing) for specific instructions (if there are any).'],
  ['Shooting Time/Addition','The schedule and selected methodology are designed to accomplish the goals and wishes of the Client. Cheerful co-operation and punctuality by all members of the Event staff are therefore essential.'],
  ['House Rules','Livetake Productions\' personnel are limited by the guidelines of event officials and/or event location site management. Negotiation with officials for moderation of guidelines is the Client\'s responsibility.'],
  ['Technical Requirements','All technical requirements given by the client are included in this package. Failure to give further technical instructions could affect the technical setup on the day of the event. Scripts must be given to the Technical Director before the event.'],
  ['Internet','The Client shall provide the primary internet connection. The backup internet provided by Livetake Productions will only be used when there are no other options available and does not guarantee a stable connection.'],
  ['Copyright Claims','Livetake Productions will only use copyrighted materials with a valid license and will not be responsible for any Copyright problems due to unlawful use of copyrighted materials by the client.'],
  ['Other Terms','The Client shall secure a parking spot and provide crew meals on the day of the event. Livetake Productions shall keep an archive of the live-stream recording for one year. The Client shall provide external hard drive(s) for copying of files.'],
];

const CSS = `
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;background:#fff;}
.page{width:210mm;min-height:297mm;margin:0 auto;padding:14mm 16mm;background:#fff;}
@media print{html,body{width:210mm;margin:0;padding:0;}.page{padding:10mm 14mm;margin:0;}.np{display:none!important;}@page{size:A4;margin:0;}}
@media screen{body{background:#d0d0d0;}.page{box-shadow:0 4px 32px rgba(0,0,0,.2);margin:68px auto 40px;}}
.hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:14px;}
.lt{font-size:26px;font-weight:900;letter-spacing:4px;line-height:1;}
.ls{font-size:9px;color:#444;margin-top:2px;letter-spacing:1px;}
.ci{text-align:right;font-size:9px;line-height:1.65;color:#333;}
.ci strong{font-size:10px;color:#000;}
.eg{display:grid;grid-template-columns:1fr 1fr;border:1.5px solid #000;margin-bottom:14px;}
.ec{padding:5px 8px;border-bottom:1px solid #ccc;font-size:10.5px;}
.ec:nth-child(odd){border-right:1px solid #ccc;}
.pb{border:1.5px solid #000;margin-bottom:14px;}
.ph{background:#000;color:#fff;padding:5px 8px;font-weight:700;font-size:10.5px;}
.py{padding:8px;}
.pt{font-size:13px;font-weight:900;margin-bottom:8px;}
.sh{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.5px;margin:8px 0 3px;}
.si{font-size:10px;margin-bottom:2px;padding-left:12px;position:relative;}
.si::before{content:"●";position:absolute;left:0;font-size:7px;top:2px;}
.ii{font-size:9.5px;color:#222;margin-bottom:1px;padding-left:18px;position:relative;}
.ii::before{content:"✔";position:absolute;left:4px;font-size:8px;}
.ni{font-style:italic;font-size:9px;color:#555;margin-top:4px;padding-left:12px;}
.ft{width:100%;border-collapse:collapse;margin:10px 0;}
.ft td{padding:4px 8px;font-size:10px;border:1px solid #ccc;}
.lb{font-weight:600;background:#f5f5f5;width:65%;}
.vl{text-align:right;font-weight:700;}
.tr td{background:#000;color:#fff;font-weight:900;font-size:12px;}
.dr td{background:#f0f0f0;font-weight:700;}
.bx{border:1px solid #ccc;padding:8px;margin-bottom:14px;background:#fafafa;}
.bx p{font-size:10px;margin-bottom:3px;line-height:1.5;}
.cf{font-style:italic;font-size:9.5px;margin-bottom:14px;color:#333;border-left:3px solid #000;padding-left:8px;}
.th2{font-weight:700;font-size:10.5px;margin:8px 0 2px;}
.tb{font-size:9.5px;line-height:1.6;color:#222;margin-bottom:4px;}
.sg{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:28px;}
.sb{border-top:1.5px solid #000;padding-top:6px;}
.sn{font-weight:700;font-size:11px;}
.st{font-size:9.5px;color:#444;}
.bar{position:fixed;top:0;left:0;right:0;z-index:999;background:#1a1a2e;color:#fff;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font-family:Arial;font-size:13px;box-shadow:0 2px 8px rgba(0,0,0,.4);}
.bar span{color:rgba(255,255,255,.7);font-size:12px;}
.pbtn{background:#e94560;color:#fff;border:none;padding:8px 22px;font-size:13px;font-weight:700;border-radius:6px;cursor:pointer;}
.pbtn:hover{background:#c93050;}
@keyframes spin{to{transform:rotate(360deg);}}
`;

export default function QuotationPrintView() {
  const { id }    = useParams();
  const [q,       setQ]     = useState(null);
  const [error,   setError] = useState(null);

  useEffect(() => {
    // ── Read from sessionStorage — NO API call, NO timeout possible ──────────
    try {
      const stored = sessionStorage.getItem(`qprint_${id}`);
      if (stored) {
        setQ(JSON.parse(stored));
      } else {
        setError('Session expired. Please close this tab and click Print again from the Quotations page.');
      }
    } catch {
      setError('Could not read quotation data. Please close this tab and try again.');
    }
  }, [id]);

  if (!q && !error) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial',gap:'12px'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
      <div style={{width:'32px',height:'32px',border:'3px solid #eee',borderTop:'3px solid #333',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
      <span style={{color:'#666',fontSize:'14px'}}>Preparing document...</span>
    </div>
  );

  if (error) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'Arial',textAlign:'center',padding:'40px',gap:'16px'}}>
      <div style={{fontSize:'48px'}}></div>
      <p style={{color:'#c00',fontSize:'15px',fontWeight:'bold',maxWidth:'420px',lineHeight:'1.5'}}>{error}</p>
      <button onClick={()=>window.close()} style={{padding:'10px 24px',background:'#333',color:'#fff',border:'none',borderRadius:'6px',fontSize:'14px',cursor:'pointer'}}>Close Tab</button>
    </div>
  );

  const ev = q.event || {}; const cl = q.client || {};
  const tot = q.totalAmount || 0;
  const dp  = q.paymentTerms?.downpaymentAmount || tot * 0.5;
  const bal = q.paymentTerms?.balanceAmount     || tot * 0.5;

  return (
    <>
      <style>{CSS}</style>

      {/* Screen bar — hidden on print */}
      <div className="bar np">
        <span>📄 {q.quotationNumber} — {ev.eventName || '—'}</span>
        <button className="pbtn" onClick={()=>window.print()}>🖨️ Save / Print as PDF</button>
      </div>

      <div className="page">
        {/* Header */}
        <div className="hd">
          <div><div className="lt">LIVETAKE</div><div className="ls">PRODUCTIONS PHOTO AND VIDEO SERVICES</div></div>
          <div className="ci">
            <strong>{CO.name}</strong><br/>
            {CO.phone1} | {CO.phone2}<br/>
            BIR Reg. {CO.bir} | DTI Reg. No. {CO.dti}<br/>
            {CO.address}<br/>
            {CO.email} | {CO.fb}
          </div>
        </div>

        {/* Event info */}
        <div className="eg">
          <div className="ec"><strong>EVENT:</strong> {ev.eventName||'—'}</div>
          <div className="ec"><strong>CLIENT:</strong> {cl.name||'—'}</div>
          <div className="ec"><strong>DATE:</strong> {fd(ev.eventDate)}</div>
          <div className="ec"><strong>VENUE:</strong> {ev.location||'—'}</div>
        </div>

        {/* Package box */}
        <div className="pb">
          <div className="ph">PACKAGE DETAILS</div>
          <div className="py">
            <div className="pt">TOTAL: {fm(tot)}{q.tax>0?' (+VAT)':''}</div>
            {(q.services||[]).length>0&&<>
              <div className="sh">Services:</div>
              {q.services.map((s,i)=>(
                <div key={i}>
                  <div className="si">{s.name}</div>
                  {s.description&&s.description.split('\n').map((l,li)=>{
                    const t=l.trim(); if(!t)return null;
                    if(t.startsWith('•')||t.startsWith('✔')) return <div key={li} className="ii">{t.replace(/^[•✔]\s*/,'')}</div>;
                    if(t.startsWith('*')) return <div key={li} className="ni">{t}</div>;
                    return null;
                  })}
                </div>
              ))}
            </>}
            {(q.equipment||[]).length>0&&<>
              <div className="sh">Technical Setup:</div>
              {q.equipment.map((e,i)=><div key={i} className="si">{e.quantity>1?`${e.quantity} `:''}{e.name}</div>)}
            </>}
            {(q.manpower||[]).length>0&&<>
              <div className="sh">Manpower:</div>
              {q.manpower.map((m,i)=><div key={i} className="si">{m.quantity>1?`${m.quantity} `:''}{m.role}</div>)}
            </>}
          </div>
        </div>

        {/* Financial */}
        <table className="ft"><tbody>
          {q.discount>0&&<tr><td className="lb">Discount</td><td className="vl">−{fm(q.discount)}</td></tr>}
          {q.tax>0&&<tr><td className="lb">VAT</td><td className="vl">+{fm(q.tax)}</td></tr>}
          <tr className="tr"><td>TOTAL PACKAGE</td><td style={{textAlign:'right'}}>{fm(tot)}</td></tr>
          <tr className="dr"><td>50% Downpayment — upon date reservation</td><td className="vl">{fm(dp)}</td></tr>
          <tr className="dr"><td>50% Balance — on the day of the event</td><td className="vl">{fm(bal)}</td></tr>
        </tbody></table>

        {/* Payment */}
        <div className="bx">
         
          <p>{CO.bank}</p><p>{CO.name}</p><p>{CO.bankAccount}</p>
          {q.validUntil&&<p style={{marginTop:'6px',fontStyle:'italic',color:'#c00'}}><strong>Quotation valid until: {fd(q.validUntil)}</strong></p>}
        </div>

        {/* Confidentiality */}
        <div className="cf">
          Upon receipt of this quotation, the client agrees to keep the rates confidential and agrees not to disclose any information included in this document to anyone other than the parties involved.
        </div>

        {/* Terms */}
        {(q.conditions||[]).length>0
          ? q.conditions.map((c,i)=><div key={i} className="tb">{i+1}. {c}</div>)
          : TERMS.map(([h,b])=><div key={h}><div className="th2">{h}</div><div className="tb">{b}</div></div>)
        }

        {/* Signatures */}
        <div className="sg">
          <div className="sb"><div className="sn">{CO.manager}</div><div className="st">{CO.managerTitle}</div></div>
          <div className="sb"><div className="sn">{cl.name||'_______________________'}</div><div className="st">{ev.eventName||'Client'}</div></div>
        </div>
      </div>
    </>
  );
}
