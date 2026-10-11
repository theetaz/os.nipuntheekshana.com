import type { ImageMetadata } from 'astro';

import salli from '../assets/work/screens/salli-home.png';
import lankaDataLayer from '../assets/work/lanka-data-layer.png';
import agentmeter from '../assets/work/agentmeter.jpg';
import colomboAtlas from '../assets/work/colombo-atlas.jpg';
import priceLens from '../assets/work/price-lens.png';
import geopop from '../assets/work/screens/geopop-api.png';
import vidura from '../assets/work/screens/vidura-watch.png';
import mochi from '../assets/work/screens/mochi-playground.png';
import gridpulse from '../assets/work/screens/gridpulse-map.png';
import opentreasury from '../assets/work/screens/opentreasury-dashboard.png';
import colomboDelivery from '../assets/work/screens/colombo-delivery.png';
import attendly from '../assets/work/screens/attendly-dashboard.png';
import terrarun from '../assets/work/terrarun.jpg';
import goyama from '../assets/work/goyama.jpg';
import mansariya from '../assets/work/mansariya.jpg';
import ceylonHub from '../assets/work/screens/ceylon-hub-map.png';
import mendlog from '../assets/work/mendlog.jpg';
import openPay from '../assets/work/open-pay.jpg';

import salliIcon from '../assets/work/icons/salli.png';
import gridpulseIcon from '../assets/work/icons/gridpulse.svg';
import attendlyIcon from '../assets/work/icons/attendly.png';
import viduraIcon from '../assets/work/icons/vidura.svg';
import agentmeterIcon from '../assets/work/icons/agentmeter.png';
import agentmeterDevice from '../assets/work/screens/agentmeter-device.png';
import gridpulseFeed from '../assets/work/screens/gridpulse-feed.png';
import attendlyAttendance from '../assets/work/screens/attendly-attendance.png';
import attendlyBilling from '../assets/work/screens/attendly-billing.png';
import attendlyStudents from '../assets/work/screens/attendly-students.png';
import attendlySession from '../assets/work/screens/attendly-session.png';
import opentreasuryIcon from '../assets/work/icons/opentreasury.svg';
import opentreasuryJournal from '../assets/work/screens/opentreasury-journal.png';
import opentreasuryReconciliation from '../assets/work/screens/opentreasury-reconciliation.png';
import opentreasuryVerify from '../assets/work/screens/opentreasury-verify-dialog.png';
import opentreasuryInsights from '../assets/work/screens/opentreasury-insights.png';
import opentreasuryVerified from '../assets/work/screens/opentreasury-verified.png';
import opMerchantPayments from '../assets/work/screens/open-pay-merchant-payments.png';
import opMerchantDashboard from '../assets/work/screens/open-pay-merchant-dashboard.png';
import opWithdrawals from '../assets/work/screens/open-pay-merchant-withdrawals.png';
import opLinks from '../assets/work/screens/open-pay-merchant-payment-links.png';
import opAdmin from '../assets/work/screens/open-pay-admin-dashboard.png';
import opAdminWithdrawals from '../assets/work/screens/open-pay-admin-withdrawals.png';
import opCheckout from '../assets/work/screens/open-pay-checkout.png';
import opMobileLink from '../assets/work/screens/open-pay-mobile-payment-link.png';
import opMobileCheckout from '../assets/work/screens/open-pay-mobile-checkout.png';
import opMobileWallet from '../assets/work/screens/open-pay-mobile-sandbox-wallet.png';
import priceLensIcon from '../assets/work/icons/price-lens.png';
import ldlIcon from '../assets/work/icons/lanka-data-layer.svg';
import plBoard from '../assets/work/screens/price-lens-board.png';
import plProduct from '../assets/work/screens/price-lens-product.png';
import plHistory from '../assets/work/screens/price-lens-history.png';
import plBasket from '../assets/work/screens/price-lens-basket.png';
import plRecipes from '../assets/work/screens/price-lens-recipes.png';
import plDeals from '../assets/work/screens/price-lens-deals.png';
import plBoardDark from '../assets/work/screens/price-lens-board-dark.png';
import plMobileProduct from '../assets/work/screens/price-lens-mobile-product.png';
import plMobileBoard from '../assets/work/screens/price-lens-mobile-board.png';
import plMobileBasket from '../assets/work/screens/price-lens-mobile-basket.png';
import plMobileRecipe from '../assets/work/screens/price-lens-mobile-recipe.png';
import ldlMap from '../assets/work/screens/ldl-map-population.png';
import ldlSelection from '../assets/work/screens/ldl-map-selection.png';
import ldlSearch from '../assets/work/screens/ldl-map-search.png';
import ldlDocs from '../assets/work/screens/ldl-docs-home.png';
import ldlReverse from '../assets/work/screens/ldl-endpoint-reverse.png';
import ldlPostal from '../assets/work/screens/ldl-postal-demo.png';
import ldlDatasets from '../assets/work/screens/ldl-datasets.png';
import ldlMobileSelection from '../assets/work/screens/ldl-mobile-map-selection.png';
import ldlMobileDocs from '../assets/work/screens/ldl-mobile-docs-home.png';
import mendlogIcon from '../assets/work/icons/mendlog.png';
import mlHome from '../assets/work/screens/mendlog-home.png';
import mlHomeDark from '../assets/work/screens/mendlog-home-dark.png';
import mlJobs from '../assets/work/screens/mendlog-jobs.png';
import mlTranscript from '../assets/work/screens/mendlog-transcript.png';
import mlRecording from '../assets/work/screens/mendlog-recording.png';
import mlSearch from '../assets/work/screens/mendlog-search.png';
import mlCalendar from '../assets/work/screens/mendlog-calendar.png';
import mlProfile from '../assets/work/screens/mendlog-profile.png';
import ch3d from '../assets/work/screens/ch-3d.png';
import chMDistrict from '../assets/work/screens/ch-m-district.png';
import chElection from '../assets/work/screens/ch-election.png';
import chInfra from '../assets/work/screens/ch-infra.png';
import chEnvironment from '../assets/work/screens/ch-environment.png';
import chServices from '../assets/work/screens/ch-services.png';
import chDataset from '../assets/work/screens/ch-dataset.png';
import chM3d from '../assets/work/screens/ch-m-3d.png';
import chMLayers from '../assets/work/screens/ch-m-layers.png';
import atlasAerial from '../assets/work/screens/atlas-aerial.png';
import atlasMMap from '../assets/work/screens/atlas-m-map.png';
import atlasGolden from '../assets/work/screens/atlas-golden.png';
import atlasFort from '../assets/work/screens/atlas-fort.png';
import atlasStorm from '../assets/work/screens/atlas-storm.png';
import atlasPlaces from '../assets/work/screens/atlas-places.png';
import atlasModels from '../assets/work/screens/atlas-models.png';
import atlasMMenu from '../assets/work/screens/atlas-m-menu.png';
import cdRide from '../assets/work/screens/cd-ride.png';
import cdOffer from '../assets/work/screens/cd-offer.png';
import cdStreet from '../assets/work/screens/cd-street.png';
import cdStudio from '../assets/work/screens/cd-studio.png';
import mochiHome from '../assets/work/screens/mochi-home.png';
import mochiMNimbus from '../assets/work/screens/mochi-m-nimbus.png';
import mochiPeach from '../assets/work/screens/mochi-peach.png';
import mochiMoods from '../assets/work/screens/mochi-moods.png';
import mochiPicker from '../assets/work/screens/mochi-picker.png';
import mochiDocs from '../assets/work/screens/mochi-docs.png';
import mochiMHome from '../assets/work/screens/mochi-m-home.png';
import goyamaCrops from '../assets/work/screens/goyama-crops.png';
import goyamaChilli from '../assets/work/screens/goyama-chilli.png';
import goyamaZones from '../assets/work/screens/goyama-zones.png';
import goyamaPrices from '../assets/work/screens/goyama-prices.png';
import terrarunLanding from '../assets/work/screens/terrarun-landing.png';
import terrarunMLanding from '../assets/work/screens/terrarun-m-landing.png';
import mochiIcon from '../assets/work/icons/mochi.png';
import colomboAtlasIcon from '../assets/work/icons/colombo-atlas.svg';
import msAdminMap from '../assets/work/screens/ms-admin-map.png';
import msMMap from '../assets/work/screens/ms-m-map.png';
import msMStops from '../assets/work/screens/ms-m-stops.png';
import msMShare from '../assets/work/screens/ms-m-share.png';
import msMRoute from '../assets/work/screens/ms-m-route.png';
import msMSearch from '../assets/work/screens/ms-m-search.png';
import msMPlanner from '../assets/work/screens/ms-m-planner.png';
import msMSharing from '../assets/work/screens/ms-m-sharing.png';
import msMDark from '../assets/work/screens/ms-m-dark.png';
import msAdminRoute from '../assets/work/screens/ms-admin-route.png';
import msAdminRoutes from '../assets/work/screens/ms-admin-routes.png';
import msAdminSim from '../assets/work/screens/ms-admin-sim.png';
import viduraAdd from '../assets/work/screens/vidura-add.png';
import salliActivity from '../assets/work/screens/salli-activity.png';
import salliInsights from '../assets/work/screens/salli-insights.png';
import viduraLibrary from '../assets/work/screens/vidura-library.png';
import viduraChat from '../assets/work/screens/vidura-chat.png';
import gridpulseHome from '../assets/work/screens/gridpulse-home.png';
import gridpulseReport from '../assets/work/screens/gridpulse-report.png';
import geopopPopulation from '../assets/work/screens/geopop-population.png';
import attendlyCheckin from '../assets/work/screens/attendly-checkin.png';
import opentreasuryMobile from '../assets/work/screens/opentreasury-mobile.png';

export type Category = 'data' | 'apps' | 'hardware' | 'worlds' | 'ai';

export const categories: Record<Category, string> = {
  data: 'Data & geo',
  apps: 'Apps',
  hardware: 'Hardware',
  worlds: '3D & play',
  ai: 'Voice & AI',
};

export type ProjectScreen = {
  image: ImageMetadata;
  alt: string;
  label: string;
  /** Fraction of the capture's height to crop from the bottom (e.g. an Android system bar). */
  trimBottom?: number;
  /**
   * For a phone capture with no status bar of its own: the colour of the strip
   * drawn above it, so the notch does not cover the app's header.
   */
  bar?: string;
  /** The capture already includes its own window frame and shadow. */
  bare?: boolean;
};

/** A small floating detail beside the product in a branded hero. */
export type BrandCard =
  | { kind: 'stat'; label: string; value: string; note?: string; progress?: number }
  | { kind: 'steps'; label: string; steps: string[]; footnote?: string }
  | { kind: 'code'; label: string; lines: string[]; footnote?: string };

/** A real request and its response, for projects that are an API and nothing else. */
export type BrandApi = {
  method: string;
  host: string;
  path: string;
  status: string;
  time?: string;
  /** The response body, already formatted. */
  body: string;
};

/** One panel of a store-style feature image: a claim, and the capture that shows it. */
export type BrandPanel = {
  /** A short label set on its own strip above the headline. */
  kicker?: string;
  title: string;
  /** A supporting line on a dark band under the headline. */
  band?: string;
  /** Which of the project's `screens` the phone shows. */
  screen: number;
};

/** Everything the branded hero on a project page needs to look like the product. */
export type ProjectBrand = {
  /** The product's own icon; a monogram in the accent colour stands in without one. */
  icon?: ImageMetadata;
  /** Letters for that monogram. Defaults to the title's first letter. */
  monogram?: string;
  /** Accent colour, taken from the product itself. */
  color: string;
  /** Text colour that sits on the accent. */
  ink: string;
  /** What the accent is deepened with on light backgrounds. Defaults to black. */
  shade?: string;
  /** Backdrop base colours for the dark and light themes. */
  backdrop: { dark: string; light: string };
  platform: string;
  platformNote: string;
  chips: string[];
  /** Main button. Defaults to the live site, then the source. */
  cta?: { label: string; href: string };
  /** Short address shown beside the button. Defaults to the live site's. */
  domain?: string;
  /** Address shown in the browser mockup. Defaults to `domain`. */
  address?: string;
  /** How the product is staged. Worked out from the captures when omitted. */
  stage?: 'phones' | 'browser' | 'api' | 'photo' | 'panels';
  /** Store-style feature panels; when present they replace the plain phones. */
  panels?: BrandPanel[];
  api?: BrandApi;
  cards?: BrandCard[];
};

export type Project = {
  slug: string;
  title: string;
  /** Native-script name, when the project has one. */
  native?: string;
  tagline: string;
  description: string;
  category: Category;
  stack: string[];
  status: 'active' | 'incubating' | 'archived';
  year: number;
  repo?: string;
  live?: string;
  /** Long-form story on prabhavalabs.com. */
  story?: string;
  image: ImageMetadata;
  /** Describe the image when it carries information; decorative covers can omit it. */
  imageAlt?: string;
  featured?: boolean;
  /** Original product captures, composed into device frames on the card. */
  screens?: ProjectScreen[];
  /** Hue (0–360) of the gradient backdrop behind the captures. */
  tint?: number;
  /** Optional product branding for a full hero on the project page. */
  brand?: ProjectBrand;
};

const labs = 'https://github.com/prabhavalabs';
const story = (slug: string) => `https://prabhavalabs.com/projects/${slug}`;

export const projects: Project[] = [
  {
    slug: 'lanka-data-layer',
    title: 'Lanka Data Layer',
    tagline: 'Sri Lanka’s open geo-data API',
    description:
      'Reverse geocoding, universal search, postal codes, population and election results for every GN division, DS division, district and province. All spatial work is precomputed offline, so every request is one indexed SQLite read. Free, no API keys.',
    category: 'data',
    stack: ['TypeScript', 'Bun', 'SQLite', 'Vite'],
    status: 'active',
    year: 2026,
    repo: `${labs}/lanka-data-layer`,
    live: 'https://lanka-data-layer.prabhavalabs.com',
    image: lankaDataLayer,
    tint: 342,
    brand: {
      icon: ldlIcon,
      color: '#e5537a',
      ink: '#22040c',
      shade: '#5c0a24',
      backdrop: { dark: '#090c10', light: '#fbf1f3' },
      platform: 'Open API & map explorer',
      platformNote: 'Bun · SQLite · MIT',
      cta: { label: 'Explore the map', href: 'https://lanka-data-layer.prabhavalabs.com' },
      domain: 'lanka-data-layer.prabhavalabs.com',
      chips: ['Reverse geocoding', 'Postal codes', 'Census 2024 population', 'Election results', 'No API keys'],
      cards: [
        { kind: 'stat', label: 'Admin units', value: '14,417', note: 'province down to GN division' },
        {
          kind: 'code',
          label: 'Where am I?',
          lines: [
            'GET /v1/reverse?lat=6.9271&lon=79.8612',
            '',
            '"gnd":         "Suduwella"',
            '"district":    "Colombo District"',
            '"province":    "Western Province"',
            '"postal_code": "00200"',
          ],
          footnote: 'One indexed SQLite read',
        },
      ],
    },
    screens: [
      { image: ldlMap, label: 'Population explorer', alt: 'Lanka Data Layer explorer showing Sri Lanka as a population density heatmap with district boundaries and a layer panel' },
      { image: ldlMobileSelection, bar: '#241c23', label: 'District detail on a phone', alt: 'Lanka Data Layer on a phone with Kandy District’s census population, area and age breakdown' },
      { image: ldlSelection, label: 'District detail', alt: 'Kandy District outlined on the map with a card of its 2024 census population, density, area and demographics' },
      { image: ldlSearch, label: 'Universal search', alt: 'Searching for Kandy returns an admin unit, a postal code and a place, grouped by type' },
      { image: ldlDocs, label: 'API docs', alt: 'Lanka Data Layer documentation home with a quickstart request and the endpoint list' },
      { image: ldlReverse, label: 'Reverse geocode endpoint', alt: 'Reverse geocode documentation with parameters and a live request panel showing a 200 response' },
      { image: ldlPostal, label: 'Postal lookup', alt: 'Postal code 10500 Padukka drawn as a boundary on the map beside the raw JSON response' },
      { image: ldlDatasets, label: 'Datasets', alt: 'Catalogue of datasets with licence, feature count and source for each' },
      { image: ldlMobileDocs, bar: '#0b0e12', label: 'Docs on a phone', alt: 'Lanka Data Layer documentation home on a phone' },
    ],
    imageAlt: 'Sri Lanka rendered as a population density heatmap with district boundaries',
    featured: true,
  },
  {
    slug: 'salli',
    title: 'Salli',
    native: 'සල්ලි',
    tagline: 'A private, local-first money companion',
    description:
      'Trilingual budget tracking built around how money actually moves in Sri Lanka. Bank SMS are parsed on the device by a bundled rule engine and a custom classifier — nothing leaves the phone.',
    category: 'apps',
    stack: ['Flutter', 'Dart', 'On-device ML'],
    status: 'active',
    year: 2026,
    repo: `${labs}/salli`,
    live: 'https://salli-docs.prabhavalabs.com',
    story: story('salli'),
    image: salli,
    tint: 36,
    brand: {
      icon: salliIcon,
      color: '#e2a83a',
      ink: '#1b1304',
      shade: '#3a2300',
      backdrop: { dark: '#070b14', light: '#fbf2df' },
      platform: 'Android & iOS app',
      platformNote: 'Flutter · open source · in beta',
      chips: ['Safe to Spend', 'Bank SMS read on-device', 'Seettu, goals & budgets', 'English · සිංහල · தமிழ்'],
      panels: [
        { kicker: 'Safe to Spend', title: 'Know what today can afford', screen: 0 },
        { title: 'Every rupee in one ledger', band: 'Read from bank SMS', screen: 1 },
        { title: 'See where it went', band: 'By category and account', screen: 2 },
      ],
      cta: { label: 'Read the guide', href: 'https://salli-docs.prabhavalabs.com' },
      domain: 'salli-docs.prabhavalabs.com',
      cards: [
        { kind: 'stat', label: 'Safe to spend today', value: 'Rs. 59,990', note: '1 day to payday', progress: 0.52 },
        {
          kind: 'steps',
          label: 'On this phone',
          steps: ['Bank SMS arrives', 'Rules and classifier read it', 'You confirm · it joins the ledger'],
          footnote: 'Nothing is sent to a server',
        },
      ],
    },
    imageAlt: 'Salli’s home screen with daily spending allowance and category breakdown',
    screens: [
      { trimBottom: 0.058, image: salli, label: 'Home', alt: 'Salli home screen showing the daily spending allowance and spending categories' },
      { trimBottom: 0.058, image: salliActivity, label: 'Activity', alt: 'Salli transaction activity with sample income and expenses' },
      { trimBottom: 0.058, image: salliInsights, label: 'Insights', alt: 'Salli insights screen showing spending charts and category breakdowns' },
    ],
    featured: true,
  },
  {
    slug: 'agentmeter',
    title: 'AgentMeter',
    tagline: 'A desk display for live usage windows',
    description:
      'An ESP32-S3 with a 480×480 AMOLED touchscreen showing quota windows, reset countdowns and alerts, fed over Bluetooth by a native macOS companion. Credentials never leave the computer.',
    category: 'hardware',
    stack: ['C++', 'ESP32-S3', 'Swift', 'BLE'],
    status: 'active',
    year: 2026,
    repo: `${labs}/agentmeter`,
    image: agentmeter,
    imageAlt: 'A small round-cornered AMOLED display on a desk showing usage cards',
    tint: 256,
    brand: {
      icon: agentmeterIcon,
      color: '#a08cf7',
      ink: '#120c2b',
      shade: '#25137a',
      backdrop: { dark: '#0b0b10', light: '#f1effa' },
      platform: 'Desk device & macOS app',
      platformNote: 'ESP32-S3 · Swift',
      stage: 'photo',
      chips: ['480×480 AMOLED touchscreen', 'Encrypted Bluetooth, USB fallback', 'Reset countdowns & alerts', 'Native macOS companion'],
      cards: [
        { kind: 'stat', label: 'Sent to the device', value: '≤ 4 KB', note: 'per update, over Bluetooth' },
        {
          kind: 'steps',
          label: 'Computer to desk',
          steps: ['macOS app reads usage locally', 'Encrypted BLE carries a summary', 'The display shows what is left'],
          footnote: 'Credentials never leave the computer',
        },
      ],
    },
    screens: [
      { image: agentmeter, label: 'On the desk', alt: 'AgentMeter held in a hand above a desk, its square AMOLED screen showing usage cards' },
      { image: agentmeterDevice, bare: true, label: 'macOS companion · device health', alt: 'AgentMeter macOS app showing the connected device, firmware, power and signal details' },
    ],
    featured: true,
  },
  {
    slug: 'colombo-atlas',
    title: 'Colombo Atlas',
    tagline: 'A little bit of Colombo, in your browser',
    description:
      'Fly around Beira Lake, Lotus Tower and Fort Station in 3D. Change the light, bring in a thunderstorm, put on Sri Lankan radio, and download the landmark models as GLB or Blender files.',
    category: 'worlds',
    stack: ['Three.js', 'Blender', 'WebGL'],
    status: 'active',
    year: 2026,
    repo: 'https://github.com/theetaz/colombo-atlas',
    live: 'https://colombo.prabhavalabs.com',
    image: colomboAtlas,
    tint: 186,
    brand: {
      icon: colomboAtlasIcon,
      color: '#8fd0c8',
      ink: '#0b1f1c',
      shade: '#183b31',
      backdrop: { dark: '#0c1a21', light: '#eef3ee' },
      platform: '3D city in the browser',
      platformNote: 'Three.js · Blender',
      cta: { label: 'Fly over Colombo', href: 'https://colombo.prabhavalabs.com' },
      chips: ['Six hand-built landmarks', 'Time of day and weather', 'සිංහල · தமிழ் · English', 'Models free to download'],
      cards: [
        { kind: 'stat', label: 'Landmarks modelled', value: '6', note: 'free to download as GLB' },
        {
          kind: 'steps',
          label: 'Make it yours',
          steps: ['Four times of day', 'Five kinds of weather', 'Four radio stations'],
          footnote: 'Drawn at 30 fps, paused when still',
        },
      ],
    },
    screens: [
      { image: atlasAerial, label: 'Lotus Tower from the air', alt: 'Colombo Atlas showing a stylised 3D Colombo from above, with Lotus Tower beside Beira Lake' },
      { image: atlasMMap, bar: '#747e7c', label: 'On a phone', alt: 'Lotus Tower and Beira Lake on a phone, with a compass and menu button' },
      { image: atlasGolden, label: 'Lakeside at golden hour', alt: 'Lotus Tower across Beira Lake under a warm evening sky' },
      { image: atlasFort, label: 'Fort Station in the morning', alt: 'Colombo Fort Station with its platform roofs, named in Sinhala, Tamil and English' },
      { image: atlasStorm, label: 'Thunderstorm', alt: 'The city in heavy rain under dark cloud' },
      { image: atlasPlaces, label: 'Places of Colombo', alt: 'A list of landmarks in three languages beside the lakeside view' },
      { image: atlasModels, label: 'Model library', alt: 'The National Museum in the model viewer, with its story and download options' },
      { image: atlasMMenu, bar: '#4e5d63', label: 'Menu on a phone', alt: 'The phone menu with places, time of day, weather, views and radio' },
    ],
    imageAlt: 'A stylised 3D Colombo skyline with Lotus Tower beside the lake',
    featured: true,
  },
  {
    slug: 'lanka-price-lens',
    title: 'Lanka PriceLens',
    tagline: 'Every food price in Sri Lanka, every day',
    description:
      'Official bulletins and supermarket shelves side by side, parsed with the page and row every price came from. A basket that prices your list at every store, and recipes matched to what you have.',
    category: 'data',
    stack: ['TypeScript', 'Hono', 'PostgreSQL', 'React'],
    status: 'active',
    year: 2026,
    repo: `${labs}/lanka-price-lens`,
    live: 'https://badumila.com',
    image: priceLens,
    tint: 146,
    brand: {
      icon: priceLensIcon,
      color: '#00bc7d',
      ink: '#02140c',
      shade: '#003d28',
      backdrop: { dark: '#050706', light: '#f2f8f4' },
      platform: 'Web app, API & pipeline',
      platformNote: 'Hono · React',
      cta: { label: 'Check today’s prices', href: 'https://badumila.com' },
      domain: 'badumila.com',
      chips: ['Open markets and supermarkets', 'Basket priced at every store', '363 costed recipes', 'Works on any phone'],
      cards: [
        { kind: 'stat', label: 'Priced today', value: '134', note: 'products · 4 supermarkets · 3 official sources' },
        {
          kind: 'code',
          label: 'The API behind it',
          lines: [
            'GET /v1/public/products/product_big_onion',
            '',
            '"lowest": {',
            '  "market_label": "Dambulla",',
            '  "source_id": "cbsl_daily_price_report",',
            '  "low": 220, "high": 273',
            '}',
          ],
          footnote: 'Every price keeps its source',
        },
        {
          kind: 'steps',
          label: 'Every day',
          steps: ['Bulletins and shelves collected', 'Parsed, page and row kept', 'Published side by side'],
        },
      ],
    },
    screens: [
      { image: plBoard, label: 'Price board', alt: 'Lanka PriceLens home with today’s food prices, the month’s rising and falling items and product cards by category' },
      { image: plMobileProduct, bar: '#f5faf7', label: 'A product on a phone', alt: 'Big Onion on a phone with the cheapest open-market and supermarket price per kilogram' },
      { image: plProduct, label: 'Product detail', alt: 'Big Onion page with the cheapest open-market, supermarket and wholesale prices and each seller’s observation date' },
      { image: plHistory, label: 'Price history', alt: 'Ninety-day Big Onion price chart with one line per seller' },
      { image: plBasket, label: 'Basket across stores', alt: 'A seven-item shopping list priced at every seller, with the cheapest store marked' },
      { image: plDeals, label: 'Supermarket offers', alt: 'Supermarket markdowns with per-store filters and per-kilogram comparison' },
      { image: plRecipes, label: 'Recipes', alt: 'Catalogue of Sri Lankan dishes with time, calories and cost per serving' },
      { image: plBoardDark, label: 'Price board, dark theme', alt: 'Lanka PriceLens price board in the dark theme' },
      { image: plMobileBoard, bar: '#f4faf7', label: 'Price board on a phone', alt: 'Lanka PriceLens price board on a phone' },
      { image: plMobileBasket, bar: '#f5faf7', label: 'Basket on a phone', alt: 'The basket comparison on a phone, listing each seller’s total' },
      { image: plMobileRecipe, bar: '#f5faf7', label: 'Recipe on a phone', alt: 'Chicken kottu roti recipe page on a phone' },
    ],
    imageAlt: 'A price board comparing open-market and supermarket prices',
    featured: true,
  },
  {
    slug: 'geopop',
    title: 'GeoPop',
    tagline: 'Who lives near this coordinate, in milliseconds',
    description:
      '175 million 1 km population cells in PostGIS behind a Rust server. The grid is regular, so a coordinate maps straight to an integer cell id and a B-tree lookup — about 2 ms instead of a spatial query.',
    category: 'data',
    stack: ['Rust', 'PostGIS', 'WorldPop'],
    status: 'active',
    year: 2026,
    repo: `${labs}/geopop`,
    story: story('geopop'),
    image: geopop,
    tint: 96,
    brand: {
      color: '#a3d955',
      ink: '#10180a',
      shade: '#16330a',
      backdrop: { dark: '#070c09', light: '#f0f5e4' },
      platform: 'HTTP API',
      platformNote: 'Rust · PostGIS · open data',
      chips: ['175M+ population cells', '1 km resolution, worldwide', 'Reverse geocoding', 'Batches of 1,000 points'],
      api: {
        method: 'GET',
        host: 'localhost:8080',
        path: '/api/v1/population?lat=51.5074&lon=-0.1278',
        status: '200',
        time: '~2 ms',
        body: `{
  "code": 200,
  "message": "success",
  "payload": {
    "lat": 51.5074,
    "lon": -0.1278,
    "population": 5765.2,
    "resolution_km": 1.0
  }
}`,
      },
      cards: [
        { kind: 'stat', label: 'Cells in the grid', value: '175M+', note: 'one per square kilometre' },
        {
          kind: 'steps',
          label: 'One lookup',
          steps: ['Coordinate arrives', 'Arithmetic gives the cell id', 'One B-tree read returns it'],
          footnote: 'No spatial query',
        },
      ],
    },
    imageAlt: 'GeoPop’s Swagger interface showing population and geocoding endpoints',
    screens: [
      { image: geopop, label: 'API overview', alt: 'GeoPop Swagger API documentation with population and geocoding endpoints' },
      { image: geopopPopulation, label: 'Population lookup', alt: 'GeoPop population endpoint documentation with coordinate and radius parameters' },
    ],
    featured: true,
  },
  {
    slug: 'vidura',
    title: 'Vidura',
    native: 'විදුර',
    tagline: 'Learn from any English YouTube video — in Sinhala',
    description:
      'An installable PWA that overlays frame-accurate, LLM-translated Sinhala subtitles on YouTube, with a chat assistant grounded in everything you have watched.',
    category: 'ai',
    stack: ['TypeScript', 'PWA', 'LLM'],
    status: 'active',
    year: 2026,
    repo: `${labs}/vidura`,
    live: 'https://vidura.prabhavalabs.com',
    story: story('vidura'),
    image: vidura,
    tint: 140,
    brand: {
      icon: viduraIcon,
      color: '#aaf0c9',
      ink: '#16120f',
      shade: '#0a4a34',
      backdrop: { dark: '#100f0c', light: '#fff8e7' },
      platform: 'Installable web app',
      platformNote: 'PWA · self-hosted · open source',
      chips: ['Sinhala subtitles, in sync', 'One translation call per video', 'Chat grounded in what you watched', 'Your library on your server'],
      panels: [
        { kicker: 'In Sinhala', title: 'Learn from any YouTube lesson', screen: 0 },
        { title: 'Your own library', band: 'Every video you translated', screen: 1 },
        { title: 'Ask about the lesson', band: 'Answers from the transcript', screen: 2 },
      ],
      cta: { label: 'Open Vidura', href: 'https://vidura.prabhavalabs.com' },
      cards: [
        { kind: 'stat', label: 'Per video', value: '1 call', note: 'translated with full context' },
        {
          kind: 'steps',
          label: 'A lesson',
          steps: ['Paste a YouTube link', 'Subtitles arrive in Sinhala', 'Ask about what you watched'],
          footnote: 'Sinhala by default, not the limit',
        },
      ],
    },
    imageAlt: 'Vidura’s watch screen with a YouTube lesson and Sinhala transcript',
    screens: [
      { image: vidura, bar: '#fff9e4', label: 'Watch', alt: 'Vidura watch screen with a YouTube lesson and timestamped Sinhala transcript' },
      { image: viduraLibrary, bar: '#fff9e4', label: 'Library', alt: 'Vidura video library with translated educational videos' },
      { image: viduraChat, bar: '#fff9e4', label: 'Chat', alt: 'Vidura transcript-grounded chat interface' },
      { image: viduraAdd, bar: '#fff9e4', label: 'Add a video', alt: 'Vidura screen for adding a YouTube video to translate' },
    ],
  },
  {
    slug: 'mochi',
    title: 'Mochi',
    tagline: 'Little characters for little screens',
    description:
      'A portable C++17 animation SDK for embedded displays: four procedural characters, ten moods, allocation-free rendering into an RGB565 framebuffer, and a browser playground.',
    category: 'hardware',
    stack: ['C++17', 'ESP32-S3', 'React'],
    status: 'active',
    year: 2026,
    repo: `${labs}/mochi`,
    live: 'https://mochi.prabhavalabs.com',
    image: mochi,
    tint: 92,
    brand: {
      icon: mochiIcon,
      color: '#bdd0a2',
      ink: '#171c19',
      shade: '#2b3a1c',
      backdrop: { dark: '#121613', light: '#f6f4ec' },
      platform: 'C++ SDK & playground',
      platformNote: 'C++17 · ESP32-S3',
      cta: { label: 'Play with Mochi', href: 'https://mochi.prabhavalabs.com' },
      chips: ['Four characters', 'Ten moods', 'No heap allocation', 'Any RGB565 display'],
      cards: [
        { kind: 'stat', label: 'Heap allocations', value: '0', note: 'while animating' },
        {
          kind: 'steps',
          label: 'In the box',
          steps: ['Mochi, Sprout, Peach and Nimbus', 'Ten moods each', 'No Arduino or framework needed'],
        },
      ],
    },
    screens: [
      { image: mochiHome, label: 'Playground', alt: 'Mochi’s site with the cream Mochi waving on a device mock-up and four character cards' },
      { image: mochiMNimbus, bar: '#171c19', label: 'Nimbus on a phone', alt: 'Nimbus the blue cloud sleeping on the device, in the dark theme on a phone' },
      { image: mochiPeach, label: 'Peach, happy', alt: 'The peach cat character smiling on the device screen in the dark theme' },
      { image: mochiMoods, label: 'Mood picker', alt: 'The device screen listing the ten moods' },
      { image: mochiPicker, label: 'Character picker', alt: 'The picker with Mochi, Sprout, Peach and Nimbus' },
      { image: mochiDocs, label: 'Documentation', alt: 'The characters and states page of the documentation' },
      { image: mochiMHome, bar: '#f6f4ec', label: 'Playground on a phone', alt: 'The playground on a phone' },
    ],
    imageAlt: 'Mochi’s live playground with the animated character and device controls',
  },
  {
    slug: 'gridpulse',
    title: 'GridPulse',
    tagline: 'A live map of every power cut in Sri Lanka',
    description:
      'Crowdsourced outage reports fused with official CEB data. Mobile-first, offline-first and trilingual.',
    category: 'data',
    stack: ['TypeScript', 'PWA', 'Maps'],
    status: 'active',
    year: 2026,
    repo: `${labs}/gridpulse`,
    live: 'https://gridpulse-cyr.pages.dev',
    story: story('gridpulse'),
    image: gridpulse,
    tint: 264,
    brand: {
      icon: gridpulseIcon,
      color: '#a78bfa',
      ink: '#140a2e',
      shade: '#3b0f9e',
      backdrop: { dark: '#0a0813', light: '#f3effd' },
      platform: 'Mobile web app',
      platformNote: 'PWA · offline-first · open source',
      chips: ['Official CEB outages', 'Reports from neighbours', 'Works without a signal', 'English · සිංහල · தமிழ்'],
      panels: [
        { kicker: 'Live map', title: 'Every power cut on one map', screen: 0 },
        { title: 'Report in two taps', band: 'No account needed', screen: 2 },
        { title: 'Is the power on?', band: 'Your area at a glance', screen: 1 },
      ],
      cta: { label: 'Open the map', href: 'https://gridpulse-cyr.pages.dev' },
      cards: [
        { kind: 'stat', label: 'To report an outage', value: '2 taps', note: 'no account, email or phone number' },
        {
          kind: 'steps',
          label: 'One map',
          steps: ['The official outage schedule', 'What neighbours are reporting', 'Saved offline, synced later'],
          footnote: 'Built for a dark room and a weak signal',
        },
      ],
    },
    imageAlt: 'GridPulse’s mobile map showing outage reports around Wennappuwa',
    screens: [
      { image: gridpulse, bar: '#ffffff', label: 'Outage map', alt: 'GridPulse mobile map showing outage markers around Wennappuwa' },
      { image: gridpulseHome, bar: '#ffffff', label: 'Home', alt: 'GridPulse home screen with power status and recent outage reports' },
      { image: gridpulseReport, bar: '#ffffff', label: 'Report an outage', alt: 'GridPulse outage-report form with a location choice and an optional note' },
      { image: gridpulseFeed, bar: '#ffffff', label: 'Feed', alt: 'GridPulse feed of recent outage reports' },
    ],
  },
  {
    slug: 'opentreasury',
    title: 'OpenTreasury',
    tagline: 'Public spending anyone can verify',
    description:
      'A public-finance transparency and treasury-management platform on Go, PostgreSQL and Hyperledger Fabric.',
    category: 'data',
    stack: ['Go', 'Hyperledger Fabric', 'Kubernetes'],
    status: 'active',
    year: 2026,
    repo: `${labs}/opentreasury`,
    story: story('opentreasury'),
    image: opentreasury,
    tint: 208,
    brand: {
      icon: opentreasuryIcon,
      color: '#2dd4bf',
      ink: '#06211d',
      shade: '#0f3d56',
      backdrop: { dark: '#06090c', light: '#edf4f5' },
      platform: 'Dashboard, ledger & verifier',
      platformNote: 'Go · Hyperledger Fabric',
      address: 'localhost/treasury/overview',
      chips: ['Double-entry journal', 'Merkle proofs anchored on a ledger', 'Verify in a browser or on a phone', 'One command to run it all'],
      cards: [
        { kind: 'stat', label: 'Every anchor needs', value: '2 orgs', note: 'to endorse it on the ledger' },
        {
          kind: 'steps',
          label: 'Checking an entry',
          steps: ['Recompute the entry’s hash', 'Walk its Merkle proof', 'Compare with the anchored root'],
          footnote: 'On your device, not our servers',
        },
      ],
    },
    imageAlt: 'OpenTreasury’s local dashboard with account balances and treasury charts',
    screens: [
      { image: opentreasury, label: 'Treasury overview', alt: 'OpenTreasury local dashboard showing treasury balances and posted flows' },
      { image: opentreasuryVerified, bar: '#131316', label: 'Phone verifier', alt: 'OpenTreasury phone verifier showing a journal entry marked verified, anchored and unmodified' },
      { image: opentreasuryJournal, label: 'Journal', alt: 'OpenTreasury journal of balanced double-entry postings with a verify action on each entry' },
      { image: opentreasuryVerify, label: 'Verify an entry', alt: 'OpenTreasury dialog verifying a journal entry against its Merkle proof in the browser' },
      { image: opentreasuryReconciliation, label: 'Reconciliation', alt: 'OpenTreasury reconciliation of staged source records against posted journal entries' },
      { image: opentreasuryInsights, label: 'Insights', alt: 'OpenTreasury insights with flow projections and unusual amounts' },
      { image: opentreasuryMobile, bar: '#131316', label: 'Public ledger on a phone', alt: 'OpenTreasury mobile public ledger overview' },
    ],
  },
  {
    slug: 'colombo-delivery',
    title: 'Colombo Delivery',
    tagline: 'A delivery game on Colombo’s real roads',
    description:
      'A browser game built on real Colombo coordinates: a playable bicycle prototype around Lotus Tower, Blender district scenes and animation studies, with motorbikes and cars on the roadmap.',
    category: 'worlds',
    stack: ['Three.js', 'Blender', 'Python'],
    status: 'incubating',
    year: 2026,
    repo: 'https://github.com/theetaz/colombo-delivery',
    image: colomboDelivery,
    tint: 22,
    brand: {
      monogram: 'CD',
      color: '#e9794a',
      ink: '#1d0a02',
      shade: '#5a2208',
      backdrop: { dark: '#0e1816', light: '#f4f1e9' },
      platform: 'Browser game prototype',
      platformNote: 'Three.js · Blender',
      address: 'localhost:5173',
      chips: ['Real Colombo roads', 'A bicycle you have to balance', 'Three practice jobs', 'Build your courier'],
      cards: [
        { kind: 'stat', label: 'Real Colombo, playable', value: '900 m', note: 'square, drawn from 109 map ways' },
        {
          kind: 'steps',
          label: 'A shift',
          steps: ['Accept a job', 'Collect the parcel', 'Ride it across the district'],
          footnote: 'Pays 80, 110 and 130 credits',
        },
      ],
    },
    screens: [
      { image: cdRide, label: 'Practice delivery', alt: 'A courier with a delivery backpack cycling down a low-poly street, with speed, job timer and minimap' },
      { image: cdOffer, label: 'Job offer', alt: 'A card offering the first delivery, from Lake Garden Market to Verandah Lane' },
      { image: cdStreet, label: 'Lake Garden Street', alt: 'The courier cycling past houses and an oncoming van' },
      { image: cdStudio, label: 'Courier Studio', alt: 'The character customiser with the courier and tabs for face, hair and clothes' },
    ],
    imageAlt: 'The playable Colombo Delivery prototype with a bicycle courier on the Lotus Tower district roads',
  },
  {
    slug: 'attendly',
    title: 'Attendly',
    tagline: 'A tuition class, run from one door',
    description:
      'Attendance, billing and notifications for a 100+ student class: Go with embedded SQLite, a React admin portal, and an offline-capable Expo app for QR check-in at the door.',
    category: 'apps',
    stack: ['Go', 'SQLite', 'React', 'Expo'],
    status: 'active',
    year: 2026,
    repo: `${labs}/attendly`,
    live: 'https://attendly.prabhavalabs.com',
    story: story('attendly'),
    image: attendly,
    tint: 166,
    brand: {
      icon: attendlyIcon,
      color: '#2ea493',
      ink: '#03201c',
      shade: '#052824',
      backdrop: { dark: '#06110f', light: '#eef6f4' },
      platform: 'Admin portal & door app',
      platformNote: 'Go · React · Expo',
      chips: ['QR check-in at the door', 'Fees and billing', 'Works offline, syncs later', 'One small server'],
      cards: [
        { kind: 'stat', label: 'Runs the whole class', value: '1 process', note: 'Go, with the database inside' },
        {
          kind: 'steps',
          label: 'At the door',
          steps: ['A student shows their QR code', 'The phone checks them in', 'Offline check-ins queue and sync'],
          footnote: 'Built for 100+ students',
        },
      ],
    },
    imageAlt: 'Attendly’s admin dashboard showing attendance, fee collections and sessions',
    screens: [
      { image: attendly, label: 'Class dashboard', alt: 'Attendly admin dashboard showing student counts, fee collections and attendance' },
      { image: attendlySession, bar: '#ffffff', label: 'Door check-in', alt: 'Attendly door app on the check-in screen, ready to scan a student QR card' },
      { image: attendlyCheckin, bar: '#ffffff', label: 'Today’s sessions', alt: 'Attendly door app listing today’s sessions with attendance counts' },
      { image: attendlyAttendance, label: 'Attendance', alt: 'Attendly admin attendance view by session' },
      { image: attendlyBilling, label: 'Billing', alt: 'Attendly admin billing view with fee collections' },
      { image: attendlyStudents, label: 'Students', alt: 'Attendly admin list of students' },
    ],
  },
  {
    slug: 'terrarun',
    title: 'TerraRun',
    tagline: 'Run a loop, own the land inside it',
    description:
      'A territorial fitness game: close a GPS loop and the polygon becomes yours. Rivals take it back by re-running your route with 85% coverage, measured by Hausdorff distance.',
    category: 'worlds',
    stack: ['Go', 'PostGIS', 'React'],
    status: 'incubating',
    year: 2026,
    repo: `${labs}/terrarun`,
    story: story('terrarun'),
    image: terrarun,
    tint: 18,
    imageAlt: 'TerraRun sign-in over a dimmed map of Colombo',
    brand: {
      monogram: 'TR',
      color: '#f2683a',
      ink: '#1c0800',
      shade: '#5c1900',
      backdrop: { dark: '#090b0c', light: '#f8f2ee' },
      platform: 'Mobile web game',
      platformNote: 'Go · PostGIS · incubating',
      address: 'localhost · terrarun',
      chips: ['Close a loop, own the land', 'Take it back by re-running', 'Live over WebSockets', 'Speed checks against cars'],
      cards: [
        { kind: 'stat', label: 'Coverage to capture', value: '85%', note: 'of the rival’s route, re-run' },
        {
          kind: 'steps',
          label: 'Claiming ground',
          steps: ['Run a loop with GPS on', 'Finish within 50 m of the start', 'The polygon inside is yours'],
          footnote: 'Capped at 45 km/h',
        },
      ],
    },
    screens: [
      { image: terrarunLanding, label: 'Landing', alt: 'TerraRun title and sign-in card over a dimmed map of Colombo' },
      { image: terrarunMLanding, bar: '#272f3d', label: 'Landing on a phone', alt: 'The TerraRun sign-in card over a map on a phone' },
    ],
  },
  {
    slug: 'goyama',
    title: 'Goyama',
    native: 'ගොයම',
    tagline: 'An open knowledge base for Sri Lankan farming',
    description:
      'A structured, trilingual corpus of Sri Lankan agriculture with per-field provenance, across 46 agro-ecological zones and two cultivation seasons.',
    category: 'data',
    stack: ['Go', 'PostGIS', 'Open data'],
    status: 'incubating',
    year: 2026,
    repo: `${labs}/goyama`,
    story: story('goyama'),
    image: goyama,
    tint: 112,
    imageAlt: 'Goyama crop explorer listing crops by category',
    brand: {
      monogram: 'ගො',
      color: '#63c257',
      ink: '#06170a',
      shade: '#123d0e',
      backdrop: { dark: '#080b0d', light: '#f6f8f0' },
      platform: 'Open corpus & web client',
      platformNote: 'Go · PostGIS · incubating',
      address: 'localhost · goyama',
      chips: ['Source kept for every field', 'Reviewed by agronomists', 'English · සිංහල · தமிழ்', 'Open licences'],
      cards: [
        { kind: 'stat', label: 'Crops in the seed corpus', value: '98', note: 'with 34 diseases and 28 pests' },
        {
          kind: 'steps',
          label: 'Every record',
          steps: ['Carries its source, field by field', 'Waits for agronomist review', 'Only then is it published'],
        },
      ],
    },
    screens: [
      { image: goyamaCrops, label: 'Crop explorer', alt: 'Goyama crop explorer with 98 crops, category filters and search' },
      { image: goyamaChilli, label: 'A crop page', alt: 'The chilli page with duration, elevation, rainfall, temperature, soil pH and yield' },
      { image: goyamaZones, label: 'Zone map', alt: 'Sri Lanka with wet, intermediate and dry zone overlays and a popup of crops grown in the intermediate zone' },
      { image: goyamaPrices, label: 'Wholesale prices (sample data)', alt: 'A wholesale price table with low, average and high prices and the trend' },
    ],
  },
  {
    slug: 'mansariya',
    title: 'Mansariya',
    tagline: 'Bus tracking with no hardware on buses',
    description:
      'Live bus tracking crowdsourced from passengers, so no tracking hardware has to be fitted to a single bus. A React Native app for riders, a Go backend that turns phones into buses, and an admin for routes and stops.',
    category: 'apps',
    stack: ['Go', 'React Native', 'PostGIS'],
    status: 'active',
    year: 2026,
    repo: `${labs}/mansariya`,
    story: story('mansariya'),
    image: mansariya,
    tint: 158,
    imageAlt: 'Mansariya live bus map of Colombo',
    brand: {
      monogram: 'M',
      color: '#25b888',
      ink: '#02160f',
      shade: '#0f6e56',
      backdrop: { dark: '#090d0b', light: '#eef8f4' },
      platform: 'Mobile app, backend & admin',
      platformNote: 'Go · React Native',
      address: 'localhost/admin/live-map',
      chips: ['No hardware on buses', 'No accounts', 'සිංහල · தமிழ் · English', 'A map with no API bill'],
      cards: [
        { kind: 'stat', label: 'Riders to verify a bus', value: '3', note: 'one is enough for a position' },
        {
          kind: 'steps',
          label: 'A phone becomes a bus',
          steps: ['A GPS point every five seconds', 'Matched to a route’s shape', 'Phones moving together are one bus'],
          footnote: 'Device ids rotate every day',
        },
      ],
    },
    screens: [
      { image: msAdminMap, label: 'Admin · live map (simulated buses)', alt: 'Mansariya admin live map of Colombo with bus markers and a list of active buses with confidence badges' },
      { image: msMMap, label: 'Live map', alt: 'Mansariya on a phone showing Colombo with route-numbered bus markers and a count of live buses' },
      { image: msMStops, label: 'Buses and stops on a route', alt: 'Route 138 with four active buses at different confidence levels above a timeline of stops in English and Sinhala' },
      { image: msMShare, label: 'I’m on a bus', alt: 'The share-your-trip sheet with a route, a bus number and how crowded it is' },
      { image: msMRoute, label: 'A route on the map', alt: 'The Pettah to Kottawa route drawn on the map with a bus marked as verified by four contributors' },
      { image: msMSearch, label: 'Route search', alt: 'Searching for Pettah lists matching routes with their numbers and operator filters' },
      { image: msMPlanner, label: 'Journey planner', alt: 'Planning a journey from Pettah to Nugegoda returns three routes' },
      { image: msMSharing, label: 'Sharing a ride', alt: 'The map while sharing location, with a count of pings sent and a stop button' },
      { image: msMDark, label: 'Live map, dark', alt: 'The live bus map on a dark basemap' },
      { image: msAdminRoute, label: 'Admin · a route', alt: 'Route 138 drawn on a map in the admin with numbered stops and a polyline editor' },
      { image: msAdminRoutes, label: 'Admin · routes', alt: 'Admin table of routes with trilingual names, stop counts and polyline status' },
      { image: msAdminSim, label: 'Admin · simulations', alt: 'Admin list of simulation jobs that replay buses for testing' },
    ],
  },
  {
    slug: 'ceylon-hub',
    title: 'Ceylon Hub',
    tagline: 'All of Sri Lanka, on one open map',
    description:
      'An interactive GIS explorer on MapLibre: boundaries, elections, population and infrastructure as layers you switch on and off. Every dataset is a static file, so there is no backend to run.',
    category: 'data',
    stack: ['React', 'MapLibre', 'Turf', 'GeoJSON'],
    status: 'incubating',
    year: 2026,
    repo: `${labs}/ceylon-hub`,
    live: 'https://ceylon-hub.pages.dev',
    story: story('ceylon-hub'),
    image: ceylonHub,
    tint: 174,
    brand: {
      monogram: 'CH',
      color: '#2bbfae',
      ink: '#02211d',
      shade: '#004d47',
      backdrop: { dark: '#080c14', light: '#eef6f5' },
      platform: 'Web map explorer',
      platformNote: 'React · MapLibre · static',
      cta: { label: 'Open the map', href: 'https://ceylon-hub.pages.dev' },
      chips: ['Boundaries to 330 DS divisions', 'Four election results', 'Population in 3D', 'Roads, rail, schools, hospitals'],
      cards: [
        { kind: 'stat', label: 'Road segments', value: '11,252', note: 'with 5,390 schools and 1,228 hospitals' },
        {
          kind: 'steps',
          label: 'One map',
          steps: ['Provinces, districts, DS divisions', 'Elections from 2015 to 2024', 'Waterways and protected areas'],
          footnote: 'Every layer is a static file',
        },
      ],
    },
    screens: [
      { image: ch3d, label: 'Population in 3D', alt: 'Ceylon Hub with Sri Lanka’s 25 districts extruded by population on a dark map, beside the layer list' },
      { image: chMDistrict, bar: '#1d161e', label: 'District detail on a phone', alt: 'Matale District on a phone with its population, area, density and DS divisions' },
      { image: chElection, label: '2024 presidential results', alt: 'Electoral divisions coloured by the winning candidate, with a party legend' },
      { image: chInfra, label: 'Infrastructure', alt: 'Provinces with roads, railways, cities and airports, and a legend of feature counts' },
      { image: chEnvironment, label: 'Divisions, waterways and protected areas', alt: '330 DS division outlines with rivers, reservoirs and protected areas' },
      { image: chServices, label: 'Polling divisions, hospitals and schools', alt: '160 polling divisions with hospital and school points' },
      { image: chDataset, label: 'A dataset page', alt: 'Road network dataset page with its source, licence, counts and sample road names' },
      { image: chM3d, bar: '#0c090c', label: '3D population on a phone', alt: 'Extruded district columns on a phone' },
      { image: chMLayers, bar: '#1d161e', label: 'Layers on a phone', alt: 'The dataset drawer on a phone, listing layers to switch on' },
    ],
    imageAlt: 'Ceylon Hub showing Sri Lanka’s population density as a 3D map with district boundaries',
  },
  {
    slug: 'mendlog',
    title: 'MendLog',
    tagline: 'Speak the repair, skip the form',
    description:
      'A voice-first field journal for industrial machine repair technicians. Jobs, photos and voice notes are written to the phone first and synced when there is a connection, with transcripts in Sinhala and English.',
    category: 'ai',
    stack: ['React Native', 'Expo', 'SQLite', 'Supabase'],
    status: 'incubating',
    year: 2026,
    repo: `${labs}/MendLog`,
    story: story('mendlog'),
    image: mendlog,
    tint: 44,
    imageAlt: 'MendLog home screen listing today’s repair jobs with an activity heatmap',
    brand: {
      icon: mendlogIcon,
      color: '#f5b800',
      ink: '#141414',
      shade: '#4a3400',
      backdrop: { dark: '#0c0c0c', light: '#f7f6f2' },
      platform: 'Android app',
      platformNote: 'Expo · offline-first',
      chips: ['Voice notes instead of forms', 'Sinhala and English transcripts', 'Works offline, syncs later', 'Search past repairs'],
      panels: [
        { kicker: 'Field journal', title: 'Every repair, logged as it happens', screen: 0 },
        { title: 'Say it out loud', band: 'Voice notes, transcribed', screen: 2 },
        { title: 'Find the last fix', band: 'Search past jobs', screen: 4 },
      ],
      cards: [
        { kind: 'stat', label: 'Network calls to save', value: '0', note: 'it is written to the phone first' },
        {
          kind: 'steps',
          label: 'A repair, spoken',
          steps: ['Record a voice note on the job', 'It is saved on the phone', 'The transcript arrives after sync'],
          footnote: 'Built for mid-range Android',
        },
      ],
    },
    screens: [
      { image: mlHome, bar: '#f7f6f2', label: 'Home', alt: 'MendLog home screen with three jobs logged today, a three-month activity heatmap and weekly stats' },
      { image: mlJobs, bar: '#f7f6f2', label: 'Jobs', alt: 'MendLog list of repair jobs grouped by day, each with machine, department, idle time and status' },
      { image: mlTranscript, bar: '#f7f6f2', label: 'Voice clips and transcript', alt: 'Two voice clips on a repair job with their transcripts and the job details below' },
      { image: mlRecording, bar: '#f7f6f2', label: 'Recording a voice note', alt: 'New job form with a voice note recording in progress above the save button' },
      { image: mlSearch, bar: '#f7f6f2', label: 'Search', alt: 'Search results for hydraulic with the matched field highlighted under each job' },
      { image: mlCalendar, bar: '#f7f6f2', label: 'Calendar', alt: 'Monthly calendar shaded by the number of jobs each day, with the selected day’s jobs below' },
      { image: mlProfile, bar: '#f7f6f2', label: 'Profile and sync', alt: 'Profile screen with job totals, streaks and sync controls' },
      { image: mlHomeDark, bar: '#0e0e0e', label: 'Home, dark theme', alt: 'MendLog home screen in the dark theme' },
    ],
  },
  {
    slug: 'open-pay',
    title: 'OpenPay',
    tagline: 'Crypto in, Sri Lankan rupees out',
    description: 'A merchant payment platform built as Go microservices on PostgreSQL.',
    category: 'apps',
    stack: ['Go', 'PostgreSQL', 'Microservices'],
    status: 'active',
    year: 2026,
    repo: `${labs}/open-pay`,
    story: story('open-pay'),
    image: openPay,
    tint: 24,
    imageAlt: 'OpenPay merchant portal listing crypto payments with fees and net amounts',
    brand: {
      monogram: 'OP',
      color: '#ea7a2a',
      ink: '#1c0a00',
      shade: '#5a2200',
      backdrop: { dark: '#09090b', light: '#fbf3ec' },
      platform: 'Merchant portal & checkout',
      platformNote: 'Go microservices · React',
      address: 'olp-merchant.nipuntheekshana.com/payments',
      chips: ['Hosted checkout & payment links', 'Subscriptions', 'Withdraw rupees to a bank', 'Signed webhooks & SDKs'],
      cards: [
        { kind: 'stat', label: 'Default fee', value: '2%', note: '1.5% platform + 0.5% exchange' },
        {
          kind: 'steps',
          label: 'Crypto in, rupees out',
          steps: ['The customer pays in crypto', 'The balance is credited, net of fees', 'The merchant withdraws LKR to a bank'],
          footnote: 'A payment expires after 15 minutes',
        },
      ],
    },
    screens: [
      { image: opMerchantPayments, label: 'Merchant portal · payments', alt: 'OpenPay payments table with status badges, fees and net amounts in USDT and rupees' },
      { image: opMobileLink, bar: '#09090b', label: 'Payment link', alt: 'OpenPay public payment link for a gift box priced in USDT, with a choice of wallets and exchanges' },
      { image: opMerchantDashboard, label: 'Merchant portal · dashboard', alt: 'OpenPay merchant dashboard with revenue, payment counts and recent activity' },
      { image: opWithdrawals, label: 'Merchant portal · withdrawals', alt: 'OpenPay withdrawals page with the available rupee balance and bank withdrawal history' },
      { image: opLinks, label: 'Merchant portal · payment links', alt: 'OpenPay payment link manager with reusable links and usage counts' },
      { image: opCheckout, label: 'Hosted checkout', alt: 'OpenPay hosted checkout showing the amount due in USDT, a QR code and an expiry countdown' },
      { image: opMobileCheckout, bar: '#09090b', label: 'Checkout on a phone', alt: 'OpenPay checkout on a phone with the amount due and a QR code' },
      { image: opMobileWallet, bar: '#030712', label: 'Sandbox wallet', alt: 'OpenPay sandbox wallet asking to confirm a test payment' },
      { image: opAdmin, label: 'Admin · overview', alt: 'OpenPay admin overview with merchant approvals, withdrawal approvals and service health' },
      { image: opAdminWithdrawals, label: 'Admin · withdrawal approvals', alt: 'OpenPay admin table of withdrawal requests with approve, reject and complete actions' },
    ],
  },
];

/** Earlier, client and pre-open-source work, shown as a compact archive. */
export const archive = [
  { title: 'Village 60 Plus ERP', note: 'ERP for an elderly-care home across seven locations', year: '2019', stack: 'Laravel · Vue' },
  { title: 'PGLL Logistic', note: 'Freight, containers, documentation and accounting', year: '2019', stack: 'Laravel · Vue' },
  { title: 'StoreMate SaaS', note: 'Automated Docker + Jenkins deployment pipeline', year: '2019', stack: 'Docker · Jenkins' },
  { title: 'Cooperative loans platform', note: 'Loan data for 6,000+ People’s Bank cooperative members', year: '2019', stack: 'Laravel' },
  { title: 'Hope SL', note: 'IoT soil sensing and ML-planned irrigation', year: '2018', stack: 'Kafka · Spark · Arduino' },
  { title: 'Space Hunter', note: 'Storage-space booking API and Android app, Sweden', year: '2018', stack: 'Node.js · Elasticsearch' },
  { title: 'Private PoA blockchain', note: 'Proof-of-authority chains on Kubernetes', year: '2023', stack: 'Kubernetes · Geth' },
  { title: 'Coqeep', note: 'Service-booking Android app', year: '2016', stack: 'Java · Android' },
];
