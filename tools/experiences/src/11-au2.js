// Australia, part 2: festivals and motorsport from organiser calendars
P('bathurst', 'Mount Panorama, Bathurst', 'NSW', 'AU', -33.45, 149.56, 210, ['Bathurst', 'Orange', 'Sydney']);
P('castlemaine', 'Castlemaine', 'VIC', 'AU', -37.06, 144.22, 130, ['Bendigo', 'Ballarat', 'Melbourne']);
P('halls-gap', 'Halls Gap, Grampians', 'VIC', 'AU', -37.14, 142.52, 260, ['Ballarat', 'Melbourne']);
P('noosa', 'Noosa', 'QLD', 'AU', -26.39, 153.09, 60, ['Noosa Heads', 'Sunshine Coast', 'Mooloolaba']);
P('sandown', 'Sandown Raceway', 'VIC', 'AU', -37.95, 145.17, 50, ['Melbourne']);
P('surfers-paradise', 'Surfers Paradise', 'QLD', 'AU', -28.00, 153.43, 50, ['Gold Coast', 'Sanctuary Cove']);
P('launceston-au2', 'Symmons Plains, near Launceston', 'TAS', 'AU', -41.66, 147.25, 60, ['Launceston']);

const SC = 'https://www.supercars.com/calendar';
const sc = (pl, title, dates, quote, summary, extra) => X(pl, 'sport-event', title, dates, summary, SC, quote, Object.assign({ tags: ['motorsport'] }, extra || {}));
sc('adelaide-au', 'Supercars Adelaide Grand Final 2026', '2026-11-26..2026-11-29', '26 - 29 Nov 2026 bp Adelaide Grand Final', 'Season-ending Supercars round on the Adelaide street circuit in the East Parklands.');
sc('adelaide-au', 'Supercars Adelaide Grand Final 2027', '2027-11-25..2027-11-28', '25 - 28 Nov 2027 bp Adelaide Grand Final', 'Season-ending Supercars round on the Adelaide street circuit in the East Parklands.');
sc('sydney-au', 'Supercars Sydney Super 440 2027', '2027-02-26..2027-02-28', '26 - 28 Feb 2027 Dunlop Sydney Super 440', 'Supercars season opener at Sydney Motorsport Park, Eastern Creek.');
sc('launceston-au2', 'Supercars Tasmania Super 440 2027', '2027-03-12..2027-03-14', '12 - 14 Mar 2027 Tyrepower Tasmania Super 440', 'Supercars round at Symmons Plains, south of Launceston.');
sc('albert-park', 'Supercars Melbourne SuperSprint 2027 (with the Grand Prix)', '2027-04-01..2027-04-04', '01 - 04 Apr 2027 Melbourne SuperSprint', 'Supercars races on the support card of the Australian Grand Prix at Albert Park.');
sc('christchurch-nz', 'Supercars Christchurch Super 440 2027', '2027-05-07..2027-05-09', '07 - 09 May 2027 ITM Christchurch Super 440', 'Supercars round at Ruapuna, Christchurch.', { radiusKm: 50 });
sc('darwin-au', 'Supercars Darwin Triple Crown 2027', '2027-06-18..2027-06-20', '18 - 20 Jun 2027 Darwin Triple Crown', 'Supercars dry-season round at Hidden Valley, Darwin.');
sc('perth-au', 'Supercars Perth Super 440 2027', '2027-08-06..2027-08-08', '06 - 08 Aug 2027 Bosch Power Tools Perth Super 440', 'Supercars round at Wanneroo Raceway, north of Perth.', { radiusKm: 50 });
sc('sandown', 'Sandown 500 2027', '2027-08-27..2027-08-29', '27 - 29 Aug 2027 Penrite Oil Sandown 500', 'Endurance Supercars race at Sandown, south-east Melbourne.');
sc('bathurst', 'Bathurst 1000 2027', '2027-10-07..2027-10-10', '07 - 10 Oct 2027 Repco Bathurst 1000', 'Australia\'s long-distance touring-car race at Mount Panorama, about three hours west of Sydney.');
sc('surfers-paradise', 'Gold Coast 500 2027', '2027-10-22..2027-10-24', '22 - 24 Oct 2027 Boost Mobile Gold Coast 500', 'Supercars street race through Surfers Paradise.');
sc('phillip-island', 'Supercars Phillip Island 500 2027', '2027-11-05..2027-11-07', '05 - 07 Nov 2027 Phillip Island 500', 'Supercars round at the Phillip Island circuit, two hours from Melbourne.');

X('sydney-au', 'culture-history', 'Sydney Writers\' Festival 2027', '2027-05-17..2027-05-23', 'Author talks and readings at Carriageworks, Sydney Town Hall and venues across the city.', 'https://www.swf.org.au/', 'Sydney Writers\' Festival returns to Carriageworks, Sydney Town Hall and many more venues across the city from 17–23 May 2027');
X('sydney-au', 'family', 'Sydney Royal Easter Show 2027', '2027-03-19..2027-03-30', 'Agricultural show with animals, rides and showbags at Sydney Olympic Park.', 'https://www.eastershow.com.au/', 'Sydney Royal Easter Show 19–30 March 2027', { family: true });
X('melbourne-au', 'festival-event', 'Melbourne International Film Festival 2027', '2027-08-05..2027-08-22', 'MIFF\'s 75th edition: feature films, shorts and XR in cinemas across Melbourne.', 'https://miff.com.au/', 'MIFF\'s 75th edition, running from 5–22 August 2027');
X('melbourne-au', 'food-wine', 'Long-table lunch in Kings Domain, Melbourne Food & Wine Festival 2027', '2027-03-05..2027-03-05', 'Long-table lunch in Kings Domain, part of the Melbourne Food & Wine Festival.', 'https://melbournefoodandwine.com.au/', 'World\'s Longest Lunch 2027 Presented by La Trobe Financial 5 March Kings Domain');
X('melbourne-au', 'festival-event', 'Melbourne Fringe Festival 2027', '2027-10-01..2027-10-31', 'Independent arts festival across Melbourne in October.', 'https://www.melbournefringe.com.au/', 'The Melbourne Fringe Festival will return October 2027', { seasonal: true, note: 'Exact dates not yet published.' });
X('castlemaine', 'festival-event', 'Castlemaine State Festival 2028', '2028-03-17..2028-03-26', 'Biennial arts festival in the goldfields town of Castlemaine.', 'https://www.castlemainefestival.com.au/', 'Castlemaine State Festival | 17-26 March 2028');
X('halls-gap', 'food-wine', 'Grampians Grape Escape 2027', '2027-04-30..2027-05-02', 'Wine, food and music festival at Halls Gap in the Grampians.', 'https://www.grampiansgrapeescape.com.au/', 'Fri 30 Apr – Sun 2 May, 2027');
X('perth-au', 'festival-event', 'FRINGE WORLD Festival 2027, Perth', '2027-01-20..2027-02-14', 'Summer fringe festival of comedy, cabaret and circus in Northbridge and the city.', 'https://www.fringeworld.com.au/', 'FRINGE WORLD - 20 January - 14 February 2027');
X('noosa', 'food-wine', 'Noosa Food & Wine Festival 2027', '2027-06-17..2027-06-20', 'Four-day food and wine festival at Noosa.', 'https://noosafoodandwine.com.au/', 'Noosa Food & Wine Festival June 17-20, 2027');
