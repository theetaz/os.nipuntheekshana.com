// Single source of truth for everything personal on the site.
// Edit this file to update the home page, about page, CV and command palette at once.

export const site = {
  url: 'https://nipuntheekshana.com',
  name: 'Nipun Theekshana',
  nameSinhala: 'නිපුන් තීක්ෂණ',
  fullName: 'Sesathpura Dewage Nipun Theekshana',
  title: 'Co-founder & CTO, PerfectUs · Founder, Prabhava Labs',
  role: 'Co-founder & CTO, PerfectUs',
  tagline: 'Blockchain, data & applied AI',
  description:
    'Nipun Theekshana is an engineering leader from Sri Lanka: co-founder and CTO of PerfectUs, a blockchain development studio, and founder of Prabhava Labs, a non-profit for open-source civic data, on-device ML and embedded systems.',
  location: 'Colombo, Sri Lanka',
  coordinates: { lat: 6.9271, lon: 79.8612 },
  timezone: 'Asia/Colombo',
  email: 'theekshana2@gmail.com',
  careerStart: 2016,
};

/** The downloadable CV. Replace the file in public/ and update `updated` when it changes. */
export const cv = {
  href: '/Nipun_Theekshana_CV.pdf',
  filename: 'Nipun_Theekshana_CV.pdf',
  updated: '2026-09-29',
};

export const links = {
  github: 'https://github.com/theetaz',
  linkedin: 'https://www.linkedin.com/in/nipun-theekshana/',
  prabhava: 'https://prabhavalabs.com',
  prabhavaGithub: 'https://github.com/prabhavalabs',
  source: 'https://github.com/theetaz/nipuntheekshana.com',
};

export const socials = [
  { label: 'GitHub', handle: '@theetaz', href: links.github },
  { label: 'LinkedIn', handle: 'nipun-theekshana', href: links.linkedin },
  { label: 'Prabhava Labs', handle: 'prabhavalabs.com', href: links.prabhava },
  { label: 'Email', handle: site.email, href: `mailto:${site.email}` },
];

/** Short "currently" lines that rotate in the hero. */
export const currently = [
  'Leading engineering at PerfectUs',
  'Shipping Lanka PriceLens',
  'Mapping Colombo in 3D',
  'Designing tiny-screen hardware',
  'Growing Prabhava Labs',
];

/** Headline numbers, used in the hero and on the CV page. */
export const highlights = [
  { value: '10+', label: 'Years shipping software' },
  { value: '50+', label: 'Engineers led' },
  { value: '1,000+', label: 'Smart contracts delivered' },
  { value: '0', label: 'Critical security incidents' },
];

export const summary =
  'Engineering leader with 10+ years of experience building and shipping software, including nearly five years as co-founder and CTO of PerfectUs, a blockchain development studio. Built and led an engineering organisation of 50+ engineers and delivered 1,000+ smart contracts for clients worldwide with zero critical security incidents. Previously Tech Lead at KeenEye in Colombo and Paris, leading 21 engineers across IoT, mobile and web products for European and US clients. Founded Prabhava Labs, a non-profit focused on independent open-source initiatives in civic data, on-device ML and embedded systems.';

export const competencies = [
  'Technology strategy & roadmapping',
  'Engineering organisation building & hiring',
  'Solution & platform architecture',
  'Smart contract security & audits',
  'Blockchain / Web3 product delivery',
  'Data pipelines & public data platforms',
  'Applied AI & on-device ML',
  'Pre-sales & client management',
  'Delivery governance (Agile, SDLC, CI/CD)',
  'Mentoring & talent development',
];

export type Experience = {
  org: string;
  role: string;
  period: string;
  location?: string;
  href?: string;
  summary: string;
  highlights?: string[];
  stack?: string[];
};

export const experience: Experience[] = [
  {
    org: 'PerfectUs Technologies',
    role: 'Co-founder & Chief Technology Officer',
    period: 'Dec 2021 — Present',
    location: 'Colombo, Sri Lanka',
    summary:
      'A blockchain development studio bridging Web 2.0 and Web3: smart contracts and audits, DeFi, dApps, NFT and GameFi platforms, crypto integration, and AI and bot development.',
    highlights: [
      'Co-founded the company; own technology strategy, architecture and engineering delivery across all products and client engagements.',
      'Built and led an engineering organisation of 50+ engineers across smart contracts, backend, frontend and QA, owning hiring, career growth and performance reviews.',
      'Delivered 1,000+ smart contracts for clients worldwide, including North America; led flagship builds including an NFT marketplace, a DeFi protocol and a tokenisation platform.',
      'Established secure smart-contract delivery standards and an in-house audit practice running line-by-line audits for external clients, with zero critical security incidents.',
      'Partner with the CEO on pre-sales, solution design, estimation and client relationships.',
    ],
    stack: ['Solidity', 'EVM', 'TypeScript', 'Go', 'Hyperledger Fabric'],
  },
  {
    org: 'Prabhava Labs',
    role: 'Founder (non-profit)',
    period: 'Jan 2026 — Present',
    location: 'Sri Lanka',
    href: links.prabhava,
    summary:
      'A non-profit supporting independent open-source initiatives: 8 active and 5 incubating projects across civic data, fintech, geospatial, AI and embedded systems.',
    highlights: [
      'Lanka Data Layer: a free, MIT-licensed geo-data platform replacing paid geocoding — GN-division reverse geocoding precomputed to a single indexed read, 2024 Census data and all 1,833 postal codes. Launch reached 47,000+ impressions.',
      'PriceLens: a pipeline ingesting daily prices from the Central Bank, Census Department, HARTI and four supermarket chains, where every price traces to its source page and row.',
      'Salli: a privacy-first, on-device SMS transaction classifier — 99.52% accuracy on 6,092 synthetic test messages in 2.79 MB of weights, with no data sent to the cloud.',
      'Also OpenPay, OpenTreasury, GeoPop, and ESP32-S3 work including the Mochi animation SDK and AgentMeter.',
    ],
    stack: ['TypeScript', 'Go', 'Rust', 'Dart', 'PostGIS', 'ESP32-S3'],
  },
  {
    org: 'KeenEye Solutions',
    role: 'Tech Lead',
    period: 'Sep 2019 — Oct 2021',
    location: 'Colombo, Sri Lanka · Paris, France',
    summary:
      'Custom software and team augmentation for European and international clients in medtech, IoT, logistics and m-commerce.',
    highlights: [
      'Led a team of 21 engineers delivering bespoke software across IoT, mobile and web.',
      'Architected and delivered EFL Symphony, an IoT logistics solution, end to end.',
      'Delivered Cedar, high-speed radar camera detection software for a US client.',
      'Technical stakeholder for clients in France and across Europe; mentored 50+ junior and mid-level engineers.',
    ],
    stack: ['IoT', 'Mobile', 'Web', 'Java', 'TypeScript'],
  },
  {
    org: 'Parallax Technologies',
    role: 'Tech Lead',
    period: 'Jan 2019 — Jul 2019',
    location: 'Colombo, Sri Lanka',
    summary: 'Led delivery teams through the full software development lifecycle, owning planning, code review and releases.',
    highlights: [
      'Built loan-management infrastructure for a People’s Bank cooperative society, handling loan data for 6,000+ members.',
      'Delivered Village 60 Plus, a full ERP for an elderly-care home network across 7 locations in Sri Lanka.',
      'Built PGLL Logistics: freight forwarding, documentation, consolidation, container management, accounting and finance.',
      'Built StoreMate SaaS deployment automation with Docker and Jenkins.',
    ],
    stack: ['PHP', 'Laravel', 'Vue.js', 'MySQL', 'Docker', 'Jenkins'],
  },
  {
    org: 'Self-employed',
    role: 'Freelance Software Engineer',
    period: 'Jan 2017 — Jan 2019',
    location: 'Remote',
    summary: 'Products for clients in Sri Lanka and Sweden.',
    highlights: [
      'Space Hunter: a scalable API and Android app for storage-space booking in Sweden.',
      'The Sampath Bank payment-gateway plugin for WooCommerce, and 30+ e-commerce sites.',
      'Hope SL: an IoT agriculture platform with real-time soil-moisture monitoring, automated irrigation and ML-based scheduling.',
    ],
    stack: ['Node.js', 'MongoDB', 'Elasticsearch', 'Kafka', 'Spark', 'MQTT', 'AWS'],
  },
  {
    org: 'Crowderia AB',
    role: 'Software Trainee',
    period: 'Aug 2016 — Jan 2017',
    location: 'Colombo, Sri Lanka',
    summary: 'Built Coqeep, an Android app for online service booking that connects service providers and customers.',
    stack: ['Java', 'Android'],
  },
];

export const education = {
  school: 'University of Ruhuna',
  degree: 'BSc in Computer Science',
  period: '2014 — 2017',
  location: 'Matara, Sri Lanka',
};

export const skills: { group: string; items: string[] }[] = [
  {
    group: 'Languages',
    items: ['Solidity', 'TypeScript', 'JavaScript', 'Go', 'Rust', 'Java', 'PHP', 'Python', 'Kotlin', 'Dart', 'C / C++', 'SQL'],
  },
  {
    group: 'Blockchain',
    items: ['EVM chains', 'Smart-contract development & auditing', 'DeFi', 'NFTs & GameFi', 'dApps', 'Tokenisation', 'Hyperledger Fabric', 'Crypto payments'],
  },
  {
    group: 'Backend & data',
    items: ['Node.js', 'Laravel', 'PostgreSQL / PostGIS', 'MySQL', 'MongoDB', 'Elasticsearch', 'Kafka', 'Spark / Hadoop', 'ETL pipelines'],
  },
  {
    group: 'Frontend & mobile',
    items: ['React', 'Next.js', 'Astro', 'Vue.js', 'Flutter', 'Android', 'PWAs'],
  },
  {
    group: 'Cloud & DevOps',
    items: ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Ansible', 'CI/CD', 'Linux'],
  },
  {
    group: 'AI & ML',
    items: ['On-device ML', 'LLM applications', 'Model evaluation', 'AI & bot development'],
  },
  {
    group: 'IoT & embedded',
    items: ['ESP32-S3', 'Arduino', 'MQTT', 'Bluetooth LE', 'Firmware'],
  },
];

/** How I think about building things. Distilled from the way the work actually gets done. */
export const principles = [
  {
    title: 'Publish the reasoning, not just the code',
    body: 'A README says what a tool does. The dead ends, the rejected designs and the trade-offs are what the next engineer actually needs, so they ship alongside the code.',
  },
  {
    title: 'Precompute everything that fits',
    body: 'Sri Lanka is ~70K populated square kilometres and 14K GN divisions. That fits in one SQLite file. Do the spatial work once, offline, and every request becomes an indexed read.',
  },
  {
    title: 'Private by default, local when possible',
    body: 'A bank SMS carries balances, card digits and merchants. The classifier should come to the phone, not the other way around.',
  },
  {
    title: 'Build for here',
    body: 'Trilingual from day one — English, සිංහල, தமிழ். Real bank formats, real bus routes, real power cuts. Global tools rarely know what a DS division is.',
  },
  {
    title: 'Cheap to run, easy to own',
    body: 'If a tuition teacher cannot self-host it on a small VPS, or it needs a tile server to show a map, the design is not finished yet.',
  },
  {
    title: 'Say where it stands',
    body: '“Incubating” means incubating. Synthetic benchmarks are labelled synthetic. Honest status is a feature, and it is how trust compounds.',
  },
];

export const hobbies = [
  { name: 'Music', note: 'The soundtrack behind most of the code.', icon: 'music' },
  { name: 'Photography', note: 'Noticing light and framing places.', icon: 'camera' },
  { name: 'Cycling', note: 'Distance, wind and a clear head.', icon: 'bike' },
  { name: 'Swimming', note: 'An hour with no screens at all.', icon: 'wave' },
  { name: 'Bowling', note: 'Friends, lanes and friendly rivalry.', icon: 'pins' },
  { name: 'Hardware', note: 'ESP32 boards, AMOLED panels and a soldering iron on the desk.', icon: 'chip' },
] as const;

/** What I'm focused on right now. Update this every few months. */
export const now = {
  updated: '2026-09-28',
  items: [
    'Growing Prabhava Labs into a shelf of useful, open tools for Sri Lanka.',
    'Shipping Lanka PriceLens: every food price in the country, every day, with provenance.',
    'Building Colombo Atlas and a delivery game on real Colombo roads, in the browser.',
    'Designing tiny-screen hardware: AgentMeter and the Mochi animation SDK.',
    'Starting this blog — engineering write-ups, decisions and the occasional failure.',
  ],
};
