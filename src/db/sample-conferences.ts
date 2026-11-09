// SAMPLE conference data for development and demos. Every event here is made up:
// names are prefixed "SAMPLE –", links point at example.org. Do not replace with real events.

export interface SampleConference {
  name: string;
  specialty: string;
  start_date: string;
  end_date: string;
  city: string;
  country: string;
  venue: string;
  lat: number;
  lng: number;
  cpd_points: number;
  registration_fee_cents: number;
  currency: string;
}

export const SAMPLE_PREFIX = "SAMPLE \u2013 ";

export const SAMPLE_CONFERENCES: SampleConference[] = [
  { name: "SAMPLE – Emergency Medicine Winter Forum", specialty: "Emergency Medicine", start_date: "2027-02-15", end_date: "2027-02-17", city: "Sydney", country: "Australia", venue: "Harbourside Convention Hall", lat: -33.8688, lng: 151.2093, cpd_points: 18, registration_fee_cents: 95000, currency: "AUD" },
  { name: "SAMPLE – Rural Emergency Skills Weekend", specialty: "Emergency Medicine", start_date: "2027-05-08", end_date: "2027-05-09", city: "Dubbo", country: "Australia", venue: "Western Plains Function Centre", lat: -32.2569, lng: 148.6011, cpd_points: 10, registration_fee_cents: 48000, currency: "AUD" },
  { name: "SAMPLE – Trauma & Resuscitation Summit", specialty: "Emergency Medicine", start_date: "2027-09-20", end_date: "2027-09-23", city: "Auckland", country: "New Zealand", venue: "Waterfront Events Centre", lat: -36.8485, lng: 174.7633, cpd_points: 22, registration_fee_cents: 120000, currency: "NZD" },
  { name: "SAMPLE – Cardiology Update Meeting", specialty: "Cardiology", start_date: "2027-03-04", end_date: "2027-03-06", city: "Melbourne", country: "Australia", venue: "Southbank Exhibition Rooms", lat: -37.8136, lng: 144.9631, cpd_points: 20, registration_fee_cents: 110000, currency: "AUD" },
  { name: "SAMPLE – Heart Rhythm Masterclass", specialty: "Cardiology", start_date: "2027-06-14", end_date: "2027-06-16", city: "London", country: "United Kingdom", venue: "Riverside Conference Centre", lat: 51.5072, lng: -0.1276, cpd_points: 15, registration_fee_cents: 89000, currency: "GBP" },
  { name: "SAMPLE – Interventional Cardiology Days", specialty: "Cardiology", start_date: "2027-10-11", end_date: "2027-10-14", city: "Barcelona", country: "Spain", venue: "Seafront Congress Hall", lat: 41.3874, lng: 2.1686, cpd_points: 24, registration_fee_cents: 145000, currency: "EUR" },
  { name: "SAMPLE – Paediatrics Spring Symposium", specialty: "Paediatrics", start_date: "2027-04-12", end_date: "2027-04-14", city: "Brisbane", country: "Australia", venue: "Riverfront Convention Rooms", lat: -27.4698, lng: 153.0251, cpd_points: 16, registration_fee_cents: 78000, currency: "AUD" },
  { name: "SAMPLE – Neonatal Care Workshop", specialty: "Paediatrics", start_date: "2027-07-22", end_date: "2027-07-23", city: "Wellington", country: "New Zealand", venue: "Harbour Quay Centre", lat: -41.2866, lng: 174.7756, cpd_points: 8, registration_fee_cents: 42000, currency: "NZD" },
  { name: "SAMPLE – Child Health Global Congress", specialty: "Paediatrics", start_date: "2027-11-03", end_date: "2027-11-06", city: "Toronto", country: "Canada", venue: "Lakeshore Congress Hall", lat: 43.6532, lng: -79.3832, cpd_points: 26, registration_fee_cents: 135000, currency: "CAD" },
  { name: "SAMPLE – Anaesthesia Scientific Meeting", specialty: "Anaesthesia", start_date: "2027-05-24", end_date: "2027-05-27", city: "Perth", country: "Australia", venue: "Swan River Convention Centre", lat: -31.9505, lng: 115.8605, cpd_points: 25, registration_fee_cents: 130000, currency: "AUD" },
  { name: "SAMPLE – Regional Anaesthesia Hands-On Course", specialty: "Anaesthesia", start_date: "2027-08-16", end_date: "2027-08-17", city: "Singapore", country: "Singapore", venue: "Marina Medical Hub", lat: 1.2903, lng: 103.852, cpd_points: 12, registration_fee_cents: 98000, currency: "SGD" },
  { name: "SAMPLE – Airway Management Forum", specialty: "Anaesthesia", start_date: "2027-12-01", end_date: "2027-12-03", city: "Dublin", country: "Ireland", venue: "Docklands Conference Rooms", lat: 53.3498, lng: -6.2603, cpd_points: 14, registration_fee_cents: 82000, currency: "EUR" },
  { name: "SAMPLE – General Practice Annual Conference", specialty: "General Practice", start_date: "2027-03-18", end_date: "2027-03-20", city: "Adelaide", country: "Australia", venue: "Torrens Convention Hall", lat: -34.9285, lng: 138.6007, cpd_points: 30, registration_fee_cents: 69000, currency: "AUD" },
  { name: "SAMPLE – Primary Care Innovation Day", specialty: "General Practice", start_date: "2027-06-05", end_date: "2027-06-05", city: "Hobart", country: "Australia", venue: "Waterside Pavilion", lat: -42.8821, lng: 147.3272, cpd_points: 6, registration_fee_cents: 25000, currency: "AUD" },
  { name: "SAMPLE – Family Medicine World Meeting", specialty: "General Practice", start_date: "2027-10-25", end_date: "2027-10-28", city: "Vancouver", country: "Canada", venue: "Harbour Convention Centre", lat: 49.2827, lng: -123.1207, cpd_points: 28, registration_fee_cents: 125000, currency: "CAD" },
  { name: "SAMPLE – Psychiatry Congress", specialty: "Psychiatry", start_date: "2027-04-26", end_date: "2027-04-29", city: "Darwin", country: "Australia", venue: "Top End Convention Centre", lat: -12.4634, lng: 130.8456, cpd_points: 20, registration_fee_cents: 95000, currency: "AUD" },
  { name: "SAMPLE – Youth Mental Health Forum", specialty: "Psychiatry", start_date: "2027-08-30", end_date: "2027-08-31", city: "Edinburgh", country: "United Kingdom", venue: "Old Town Assembly Rooms", lat: 55.9533, lng: -3.1883, cpd_points: 10, registration_fee_cents: 56000, currency: "GBP" },
  { name: "SAMPLE – Consultation-Liaison Psychiatry Meeting", specialty: "Psychiatry", start_date: "2028-01-19", end_date: "2028-01-21", city: "Cape Town", country: "South Africa", venue: "Waterfront Conference Hall", lat: -33.9249, lng: 18.4241, cpd_points: 15, registration_fee_cents: 980000, currency: "ZAR" },
  { name: "SAMPLE – Orthopaedic Surgery Annual Meeting", specialty: "Orthopaedics", start_date: "2027-02-22", end_date: "2027-02-25", city: "Gold Coast", country: "Australia", venue: "Broadbeach Convention Rooms", lat: -28.0167, lng: 153.4, cpd_points: 24, registration_fee_cents: 140000, currency: "AUD" },
  { name: "SAMPLE – Sports Injury & Arthroscopy Course", specialty: "Orthopaedics", start_date: "2027-07-05", end_date: "2027-07-07", city: "Munich", country: "Germany", venue: "Isar Conference Centre", lat: 48.1351, lng: 11.582, cpd_points: 18, registration_fee_cents: 110000, currency: "EUR" },
  { name: "SAMPLE – Hip & Knee Arthroplasty Forum", specialty: "Orthopaedics", start_date: "2027-11-15", end_date: "2027-11-17", city: "Tokyo", country: "Japan", venue: "Bayside International Hall", lat: 35.6762, lng: 139.6503, cpd_points: 16, registration_fee_cents: 15000000, currency: "JPY" },
  { name: "SAMPLE – Oncology Research Symposium", specialty: "Oncology", start_date: "2027-03-29", end_date: "2027-04-01", city: "Canberra", country: "Australia", venue: "Lakeside Convention Centre", lat: -35.2809, lng: 149.13, cpd_points: 22, registration_fee_cents: 105000, currency: "AUD" },
  { name: "SAMPLE – Haematology & Oncology Update", specialty: "Oncology", start_date: "2027-09-06", end_date: "2027-09-08", city: "Boston", country: "United States", venue: "Seaport Conference Center", lat: 42.3601, lng: -71.0589, cpd_points: 20, registration_fee_cents: 160000, currency: "USD" },
  { name: "SAMPLE – Palliative Care Gathering", specialty: "Oncology", start_date: "2027-12-08", end_date: "2027-12-09", city: "Christchurch", country: "New Zealand", venue: "Avon River Centre", lat: -43.5321, lng: 172.6362, cpd_points: 10, registration_fee_cents: 45000, currency: "NZD" },
  { name: "SAMPLE – Obstetrics & Gynaecology Scientific Meeting", specialty: "Obstetrics & Gynaecology", start_date: "2027-05-17", end_date: "2027-05-20", city: "Newcastle", country: "Australia", venue: "Harbour Foreshore Centre", lat: -32.9283, lng: 151.7817, cpd_points: 22, registration_fee_cents: 115000, currency: "AUD" },
  { name: "SAMPLE – Maternal-Fetal Medicine Workshop", specialty: "Obstetrics & Gynaecology", start_date: "2027-10-04", end_date: "2027-10-05", city: "Kuala Lumpur", country: "Malaysia", venue: "City Centre Convention Hall", lat: 3.139, lng: 101.6869, cpd_points: 10, registration_fee_cents: 220000, currency: "MYR" },
  { name: "SAMPLE – Intensive Care Annual Meeting", specialty: "Intensive Care", start_date: "2027-06-21", end_date: "2027-06-24", city: "Sydney", country: "Australia", venue: "Darling Harbour Exhibition Rooms", lat: -33.8731, lng: 151.201, cpd_points: 24, registration_fee_cents: 125000, currency: "AUD" },
  { name: "SAMPLE – Critical Care Ultrasound Course", specialty: "Intensive Care", start_date: "2027-09-13", end_date: "2027-09-14", city: "Melbourne", country: "Australia", venue: "Docklands Training Centre", lat: -37.815, lng: 144.946, cpd_points: 12, registration_fee_cents: 89000, currency: "AUD" },
  { name: "SAMPLE – Sepsis & Organ Support Forum", specialty: "Intensive Care", start_date: "2028-02-14", end_date: "2028-02-16", city: "San Francisco", country: "United States", venue: "Bay Conference Center", lat: 37.7749, lng: -122.4194, cpd_points: 18, registration_fee_cents: 150000, currency: "USD" },
  { name: "SAMPLE – Dermatology Update Weekend", specialty: "Dermatology", start_date: "2027-08-07", end_date: "2027-08-08", city: "Cairns", country: "Australia", venue: "Esplanade Convention Rooms", lat: -16.9186, lng: 145.7781, cpd_points: 10, registration_fee_cents: 62000, currency: "AUD" },
  { name: "SAMPLE – Skin Cancer Medicine Course", specialty: "Dermatology", start_date: "2027-11-22", end_date: "2027-11-24", city: "Lisbon", country: "Portugal", venue: "Tagus Congress Centre", lat: 38.7223, lng: -9.1393, cpd_points: 14, registration_fee_cents: 98000, currency: "EUR" },
];
