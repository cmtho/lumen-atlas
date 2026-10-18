import fs from 'node:fs/promises';
import sharp from 'sharp';

const OUT = new URL('../public/demo/', import.meta.url);
await fs.mkdir(OUT, { recursive: true });

const scenes = [
  { id:'01', cn:'冰岛 · 雷克雅未克', en:'REYKJAVÍK / ICELAND', coord:'64.1466° N  21.9426° W', date:'2025.02.14', palette:['#07121f','#123d54','#65e4e6','#d9fff2'], kind:'aurora' },
  { id:'02', cn:'日本 · 京都', en:'KYOTO / JAPAN', coord:'35.0116° N  135.7681° E', date:'2024.11.23', palette:['#1d0c18','#59213a','#ff8a68','#ffe7b0'], kind:'temple' },
  { id:'03', cn:'中国 · 北京 · 东城区', en:'BEIJING / CHINA', coord:'39.9175° N  116.4188° E', date:'2025.01.08', palette:['#091424','#173f56','#57d8ff','#f4d49b'], kind:'city' },
  { id:'04', cn:'中国 · 四川 · 成都', en:'CHENGDU / CHINA', coord:'30.6570° N  104.0830° E', date:'2024.08.17', palette:['#071b19','#165244','#8ce8ac','#f4ffd9'], kind:'forest' },
  { id:'05', cn:'中国 · 云南 · 丽江', en:'LIJIANG / CHINA', coord:'26.8720° N  100.2340° E', date:'2024.06.02', palette:['#101323','#3c426d','#b8c7ff','#fff0cf'], kind:'snow' },
  { id:'06', cn:'中国 · 西藏 · 拉萨', en:'LHASA / CHINA', coord:'29.6500° N  91.1300° E', date:'2024.09.11', palette:['#0a1025','#243a7a','#72b2ff','#ffe28a'], kind:'plateau' },
  { id:'07', cn:'挪威 · 特罗姆瑟', en:'TROMSØ / NORWAY', coord:'69.6492° N  18.9553° E', date:'2025.03.04', palette:['#08101e','#303263','#98b6ff','#dbfff5'], kind:'aurora' },
  { id:'08', cn:'中国 · 上海 · 黄浦区', en:'SHANGHAI / CHINA', coord:'31.2310° N  121.4850° E', date:'2025.04.19', palette:['#090b1d','#382152','#f178b6','#73eaff'], kind:'city' },
  { id:'09', cn:'中国 · 广东 · 深圳', en:'SHENZHEN / CHINA', coord:'22.5330° N  113.9300° E', date:'2025.05.02', palette:['#06161c','#0b4c59','#39f2d0','#c7fff5'], kind:'coast' },
];

function ridge(seed, y, amp, color, opacity=.9) {
  const pts = [];
  for (let x = -100; x <= 1700; x += 70) {
    const n = Math.sin((x + seed * 173) / 220) * 0.55 + Math.sin((x + seed * 71) / 87) * 0.25 + Math.cos((x - seed * 31) / 410) * 0.2;
    pts.push(`${x},${(y - n * amp).toFixed(1)}`);
  }
  return `<path d="M-100,1250 L${pts.join(' L')} L1700,1250 Z" fill="${color}" opacity="${opacity}"/>`;
}

function stars(seed, count = 70) {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = ((i * 967 + seed * 389) % 1600);
    const y = ((i * 613 + seed * 227) % 760);
    const r = (i % 5 === 0) ? 2.2 : 0.9;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${i%7===0?'#8ff8ff':'#ffffff'}" opacity="${0.25 + (i%4)*0.13}"/>`;
  }
  return s;
}

function sceneSvg(s) {
  const [bg, mid, accent, warm] = s.palette;
  const sunX = 900 + (Number(s.id) % 4) * 110;
  const sunY = 430 + (Number(s.id) % 3) * 45;
  const body = {
    aurora: `
      <path d="M180,150 C500,20 850,360 1450,140 L1450,430 C980,610 640,240 180,470 Z" fill="${accent}" opacity=".16" filter="url(#blur40)"/>
      <path d="M100,250 C520,90 860,400 1520,180 L1520,300 C1010,500 620,250 100,430 Z" fill="${warm}" opacity=".09" filter="url(#blur40)"/>
      ${ridge(3, 890, 120, '#071221', .95)} ${ridge(7, 990, 150, '#040b14', 1)}`,
    temple: `
      <circle cx="${sunX}" cy="${sunY}" r="170" fill="${accent}" opacity=".72" filter="url(#blur12)"/>
      <rect x="710" y="690" width="510" height="24" rx="12" fill="#160c14" opacity=".75"/>
      <path d="M790,690 L900,560 L1090,560 L1200,690 Z" fill="#1a0d16" opacity=".85"/>
      <rect x="885" y="690" width="210" height="220" fill="#180c15" opacity=".9"/>
      <path d="M820,790 L1080,790 M840,860 L1060,860" stroke="${warm}" stroke-width="4" opacity=".35"/>
      ${ridge(2, 970, 100, '#120912', 1)}`,
    city: `
      <circle cx="${sunX}" cy="${sunY}" r="210" fill="${accent}" opacity=".18" filter="url(#blur40)"/>
      <g fill="#07101c" opacity=".92">
        <rect x="250" y="610" width="130" height="420"/><rect x="400" y="520" width="180" height="510"/>
        <rect x="600" y="650" width="100" height="380"/><rect x="720" y="420" width="220" height="610"/>
        <rect x="960" y="570" width="150" height="460"/><rect x="1130" y="490" width="200" height="540"/>
        <rect x="1350" y="640" width="110" height="390"/>
      </g>
      <g fill="${accent}" opacity=".55">
        <rect x="280" y="650" width="16" height="6"/><rect x="320" y="700" width="16" height="6"/><rect x="450" y="580" width="22" height="6"/>
        <rect x="750" y="480" width="26" height="7"/><rect x="810" y="540" width="18" height="6"/><rect x="1180" y="540" width="24" height="7"/>
      </g>
      ${ridge(4, 1050, 30, '#050c15', 1)}`,
    forest: `
      <circle cx="${sunX}" cy="${sunY}" r="240" fill="${warm}" opacity=".2" filter="url(#blur40)"/>
      ${Array.from({length: 23}, (_,i)=>`<path d="M${-60+i*78},930 L${-10+i*78},${610+((i*53)%170)} L${40+i*78},930 Z" fill="#07140f" opacity="${.55+(i%4)*.1}"/>`).join('')}
      ${ridge(8, 1070, 80, '#040d0a', 1)}`,
    snow: `
      <circle cx="${sunX}" cy="${sunY}" r="130" fill="${warm}" opacity=".85" filter="url(#blur12)"/>
      <path d="M-50,970 L320,380 L540,720 L760,300 L1120,930 L1320,600 L1680,980 Z" fill="#1b2540" opacity=".9"/>
      <path d="M320,380 L260,520 L390,475 L440,560 L540,720 L460,680 L400,750 Z" fill="${warm}" opacity=".38"/>
      <path d="M760,300 L690,470 L800,430 L860,530 L930,610 L1120,930 L990,760 L900,840 Z" fill="${warm}" opacity=".32"/>
      ${ridge(5, 1080, 55, '#0b1120', 1)}`,
    plateau: `
      <circle cx="${sunX}" cy="${sunY}" r="195" fill="${warm}" opacity=".55" filter="url(#blur40)"/>
      <path d="M-20,950 Q370,780 760,900 T1660,850 L1660,1200 L-20,1200 Z" fill="#111b36"/>
      <path d="M-20,1010 Q430,860 810,990 T1660,930 L1660,1200 L-20,1200 Z" fill="#080f22"/>
      <path d="M1060,900 L1120,860 L1170,890 L1220,850 L1280,905" stroke="${warm}" stroke-width="5" fill="none" opacity=".5"/>`,
    coast: `
      <circle cx="${sunX}" cy="${sunY}" r="180" fill="${warm}" opacity=".42" filter="url(#blur40)"/>
      <rect x="-20" y="780" width="1700" height="430" fill="#04171f"/>
      ${Array.from({length: 8},(_,i)=>`<path d="M-50,${830+i*45} Q420,${790+i*45} 800,${840+i*45} T1650,${825+i*45}" stroke="${accent}" stroke-width="${2.5-i*.16}" fill="none" opacity="${.5-i*.04}"/>`).join('')}
      <path d="M0,830 L250,760 L470,845 L630,805 L800,1200 L-20,1200 Z" fill="#061018" opacity=".92"/>`,
  }[s.kind];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1200" viewBox="0 0 1600 1200">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset=".68" stop-color="${mid}"/><stop offset="1" stop-color="${bg}"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${accent}" stop-opacity=".8"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <filter id="blur40"><feGaussianBlur stdDeviation="40"/></filter>
    <filter id="blur12"><feGaussianBlur stdDeviation="12"/></filter>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .08"/></feComponentTransfer></filter>
    <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M80 0H0V80" fill="none" stroke="${accent}" stroke-width=".7" opacity=".12"/></pattern>
    <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset=".42" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".68"/></linearGradient>
  </defs>
  <rect width="1600" height="1200" fill="url(#sky)"/>
  ${stars(Number(s.id), 90)}
  <rect width="1600" height="1200" fill="url(#grid)"/>
  <circle cx="${sunX}" cy="${sunY}" r="420" fill="url(#glow)" opacity=".22"/>
  ${body}
  <rect width="1600" height="1200" fill="url(#shade)"/>
  <rect width="1600" height="1200" filter="url(#grain)" opacity=".65"/>
  <g font-family="Noto Sans CJK SC, Noto Sans, sans-serif">
    <g transform="translate(94 92)">
      <circle cx="13" cy="13" r="11" fill="none" stroke="${accent}" stroke-width="1.5"/>
      <circle cx="13" cy="13" r="3" fill="${accent}"/>
      <text x="40" y="19" fill="${warm}" font-size="19" letter-spacing="6" font-weight="600">LUMEN ATLAS</text>
      <text x="2" y="54" fill="${warm}" opacity=".55" font-size="13" letter-spacing="3">FIELD RECORD / ${s.id}</text>
    </g>
    <g transform="translate(94 840)">
      <text fill="${accent}" font-size="16" letter-spacing="5" opacity=".9">${s.coord}</text>
      <text y="78" fill="#ffffff" font-size="55" font-weight="700" letter-spacing="2">${s.cn}</text>
      <text y="124" fill="${warm}" opacity=".7" font-size="21" letter-spacing="4">${s.en}</text>
    </g>
    <g transform="translate(94 1075)">
      <line x1="0" y1="0" x2="1412" y2="0" stroke="${warm}" stroke-width="1" opacity=".22"/>
      <text y="38" fill="${warm}" opacity=".55" font-size="15" letter-spacing="3">SAMPLE ARCHIVE · ${s.date}</text>
      <text x="1412" y="38" text-anchor="end" fill="${warm}" opacity=".55" font-size="15" letter-spacing="3">35mm · f/2.8 · 1/250</text>
    </g>
  </g>
</svg>`;
}

await fs.mkdir(new URL('./thumbs/', OUT), { recursive: true });
for (const s of scenes) {
  const svg = Buffer.from(sceneSvg(s));
  await sharp(svg).webp({ quality: 88 }).toFile(new URL(`${s.id}.webp`, OUT).pathname);
  await sharp(svg).resize(720).webp({ quality: 82 }).toFile(new URL(`thumbs/${s.id}.webp`, OUT).pathname);
  console.log('demo', s.id, s.cn);
}
