// Legacy storage endpoints are disabled in this private Supabase portal build.
// Production remains unchanged; learning records use authenticated hero_* RPCs.
const disabled = (_request: Request) => Response.json({error:'Laluan lama tidak tersedia. Gunakan Supabase Hero Portal.'}, {status:410,headers:{'Cache-Control':'no-store'}});
export const GET = disabled;
export const POST = disabled;
