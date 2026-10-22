import {defineConfig,type Plugin} from 'vite';
import {schoolConfig} from './src/school-config.ts';

const escape=(text:string)=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
const manifest=()=>JSON.stringify({
  name:`${schoolConfig.siteName} · ${schoolConfig.tagline}`,short_name:schoolConfig.siteName,start_url:'/',
  display:'fullscreen',orientation:'landscape',background_color:schoolConfig.themeColor,theme_color:schoolConfig.themeColor,
  icons:[{src:'/leaf.svg',sizes:'any',type:'image/svg+xml'}],
},null,2);

/** Fills %SCHOOL_*% in index.html and serves the home-screen manifest from src/school-config.ts. */
function schoolPage():Plugin {
  const values:Record<string,string>={
    ...Object.fromEntries(Object.entries(schoolConfig).filter(([,value])=>typeof value==='string')),
    shareImageUrl:new URL(schoolConfig.shareImage,schoolConfig.siteUrl).href,
  } as Record<string,string>;
  return {
    name:'school-page',
    transformIndexHtml:html=>html.replace(/%SCHOOL_(\w+)%/g,(match,key:string)=>key in values?escape(values[key]!):match),
    configureServer(server){server.middlewares.use('/manifest.webmanifest',(_request,response)=>{response.setHeader('Content-Type','application/manifest+json');response.end(manifest());});},
    generateBundle(){this.emitFile({type:'asset',fileName:'manifest.webmanifest',source:manifest()});},
  };
}

export default defineConfig({
  plugins:[schoolPage()],
  server:{
    fs:{
      // Preserve Vite's default secret-file protection and exclude local source inputs.
      deny:[
        '.env','.env.*','*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc','.yarnrc.yml','**/.git/**',
        '**/KakaoTalkChats.txt','**/배치도*.pdf','**/교사동 도면*.pdf',
        '**/건물 외관.mp4','**/동편출입구부터 1층 내부.mp4','**/src/classrooms/**','**/references/**',
      ],
    },
  },
});
