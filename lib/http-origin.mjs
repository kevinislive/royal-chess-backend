// Browser writes are accepted only from this server or the configured public UI.
export function allowedOrigin(req,env=process.env){
  const value=req.headers.origin;
  if(!value)return true;
  try{
    const origin=new URL(value);
    if(!['http:','https:'].includes(origin.protocol)||origin.origin!==value)return false;
    if(origin.host===req.headers.host)return true;
    return !!env.PUBLIC_URL&&origin.origin===new URL(env.PUBLIC_URL).origin;
  }catch{return false;}
}
