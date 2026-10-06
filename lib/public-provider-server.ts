import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { DemoUser } from "./demo-data";
import type { Database } from "./database.types";
import { publicProviders } from "./public-marketplace";
import { loadDirectoryRows } from "./provider-directory.mjs";
import { cloudinaryPublicImageUrl, parseCloudinaryAssetRef } from "./profile-media";

const records = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string,unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const str = (value: unknown) => typeof value === 'string' ? value : undefined;

export function publicDemoEnabled(value?: string | string[]) {
  return value === '1' && (process.env.NODE_ENV === 'development' || process.env.ENABLE_DEMO_MODE === 'true');
}

export async function readPublicProviders(demo = false): Promise<{providers: DemoUser[]; error: boolean}> {
  if (demo) return { providers: publicProviders, error: false };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { providers: [], error: true };
  // Public pages deliberately use the anonymous key/session, never a service role.
  const client = createClient<Database>(url,key,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:AbortSignal.timeout(15000)})},
  });
  try {
    const rows = await loadDirectoryRows(async (cursor: string | null) => {
      let query = client.from('seller_directory').select('*').order('user_id').limit(250);
      if (cursor) query = query.gt('user_id',cursor);
      return await query;
    });
    const providers: DemoUser[] = rows.map((row: Record<string,unknown>) => {
      const name = str(row.display_name) || 'Nanas provider';
      const path = str(row.avatar_path);
      const avatarUrl = path ? parseCloudinaryAssetRef(path) ? cloudinaryPublicImageUrl(path) : client.storage.from('public-profile-media').getPublicUrl(path).data.publicUrl : undefined;
      return {
        id:String(row.user_id), publicSlug:str(row.public_slug), name, email:'', role:'seller', status:'active',
        avatar:name.split(/\s+/).slice(0,2).map(part=>part[0]).join(''),avatarUrl,
        sellerDetails:{headline:str(row.headline),locality:str(row.locality),island:str(row.island),rating:Number(row.rating_average ?? 0),reviewCount:Number(row.rating_count ?? 0),completedBookings:Number(row.completed_bookings ?? 0),responseRate:Number(row.response_rate ?? 0),languages:strings(row.languages),vaccinations:strings(row.vaccinations),additionalDetails:strings(row.additional_details),badges:records(row.badges).map(b=>String(b.name)),availabilityUpdatedAt:str(row.availability_updated_at),
          services:records(row.services).map(s=>({id:String(s.service_id),slug:str(s.slug),name:String(s.name),rate:Number(s.rate_minor)/100,rateMax:s.rate_max_minor == null ? undefined : Number(s.rate_max_minor)/100,bio:str(s.bio),yearsExperience:Number(s.years_experience ?? 0),capabilities:strings(s.capabilities),additionalHelp:strings(s.additional_help)})),
          credentials:records(row.credentials).map(c=>({type:String(c.type),issuingBody:str(c.issuing_body),verifiedAt:str(c.verified_at),expiryDate:str(c.expiry_date)})),
          safetyChecks:records(row.safety_checks).map(c=>({type:String(c.type),status:String(c.status),completedAt:str(c.completed_at),expiresAt:str(c.expires_at),summary:str(c.summary)})),
          availability:records(row.availability).map(a=>({weekday:Number(a.weekday),start:String(a.start),end:String(a.end),timezone:str(a.timezone)})),
        },
      };
    });
    return {providers,error:false};
  } catch { return {providers:[],error:true}; }
}
