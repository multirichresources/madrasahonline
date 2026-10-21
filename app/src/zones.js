// Zon waktu solat JAKIM (e-Solat). [kod, negeri, kawasan]
export const ZONES = [
  ['JHR01', 'Johor', 'Pulau Aur, Pulau Pemanggil'],
  ['JHR02', 'Johor', 'Johor Bahru, Kota Tinggi, Mersing, Kulai'],
  ['JHR03', 'Johor', 'Kluang, Pontian'],
  ['JHR04', 'Johor', 'Batu Pahat, Muar, Segamat, Gemas, Tangkak'],
  ['KDH01', 'Kedah', 'Kota Setar, Kubang Pasu, Pokok Sena'],
  ['KDH02', 'Kedah', 'Kuala Muda, Yan, Pendang'],
  ['KDH03', 'Kedah', 'Padang Terap, Sik'],
  ['KDH04', 'Kedah', 'Baling'],
  ['KDH05', 'Kedah', 'Bandar Baharu, Kulim'],
  ['KDH06', 'Kedah', 'Langkawi'],
  ['KDH07', 'Kedah', 'Puncak Gunung Jerai'],
  ['KTN01', 'Kelantan', 'Kota Bharu, Bachok, Machang, Pasir Mas, Pasir Puteh, Tanah Merah, Tumpat, Kuala Krai, Mukim Chiku'],
  ['KTN02', 'Kelantan', 'Gua Musang, Jeli, Jajahan Kecil Lojing'],
  ['MLK01', 'Melaka', 'Seluruh Negeri Melaka'],
  ['NGS01', 'Negeri Sembilan', 'Tampin, Jempol'],
  ['NGS02', 'Negeri Sembilan', 'Seremban, Jelebu, Kuala Pilah, Rembau'],
  ['NGS03', 'Negeri Sembilan', 'Port Dickson'],
  ['PHG01', 'Pahang', 'Pulau Tioman'],
  ['PHG02', 'Pahang', 'Kuantan, Pekan, Muadzam Shah'],
  ['PHG03', 'Pahang', 'Jerantut, Temerloh, Maran, Bera, Chenor, Jengka'],
  ['PHG04', 'Pahang', 'Bentong, Lipis, Raub'],
  ['PHG05', 'Pahang', 'Genting Sempah, Janda Baik, Bukit Tinggi'],
  ['PHG06', 'Pahang', 'Cameron Highlands, Genting Higlands, Bukit Fraser'],
  ['PHG07', 'Pahang', 'Rompin'],
  ['PLS01', 'Perlis', 'Kangar, Padang Besar, Arau'],
  ['PNG01', 'Pulau Pinang', 'Seluruh Negeri Pulau Pinang'],
  ['PRK01', 'Perak', 'Tapah, Slim River, Tanjung Malim'],
  ['PRK02', 'Perak', 'Ipoh, Kuala Kangsar, Sungai Siput, Batu Gajah, Kampar'],
  ['PRK03', 'Perak', 'Lenggong, Pengkalan Hulu, Grik'],
  ['PRK04', 'Perak', 'Temengor, Belum'],
  ['PRK05', 'Perak', 'Teluk Intan, Kampung Gajah, Bagan Datuk, Seri Iskandar, Beruas, Parit, Lumut, Sitiawan, Pulau Pangkor'],
  ['PRK06', 'Perak', 'Taiping, Selama, Bagan Serai, Parit Buntar'],
  ['PRK07', 'Perak', 'Bukit Larut'],
  ['SBH01', 'Sabah', 'Sandakan, Bukit Garam, Semawang, Temanggong, Tambisan'],
  ['SBH02', 'Sabah', 'Beluran, Telupid, Pinangah, Terusan, Kuamut'],
  ['SBH03', 'Sabah', 'Lahad Datu, Silabukan, Kunak, Sahabat, Semporna, Tungku'],
  ['SBH04', 'Sabah', 'Tawau, Balong, Merotai, Kalabakan'],
  ['SBH05', 'Sabah', 'Kudat, Kota Marudu, Pitas, Pulau Banggi'],
  ['SBH06', 'Sabah', 'Gunung Kinabalu'],
  ['SBH07', 'Sabah', 'Kota Kinabalu, Ranau, Kota Belud, Tuaran, Penampang, Papar, Putatan'],
  ['SBH08', 'Sabah', 'Keningau, Pensiangan, Tambunan, Nabawan'],
  ['SBH09', 'Sabah', 'Beaufort, Kuala Penyu, Sipitang, Tenom, Long Pasia, Membakut, Weston'],
  ['SGR01', 'Selangor', 'Gombak, Petaling, Sepang, Hulu Langat, Hulu Selangor, Shah Alam'],
  ['SGR02', 'Selangor', 'Kuala Selangor, Sabak Bernam'],
  ['SGR03', 'Selangor', 'Klang, Kuala Langat'],
  ['SWK01', 'Sarawak', 'Limbang, Lawas, Sundar, Trusan'],
  ['SWK02', 'Sarawak', 'Miri, Niah, Bekenu, Sibuti, Marudi'],
  ['SWK03', 'Sarawak', 'Bintulu, Pandan, Belaga, Suai, Tatau, Sebauh'],
  ['SWK04', 'Sarawak', 'Sibu, Mukah, Dalat, Song, Igan, Oya, Balingian, Kanowit, Kapit'],
  ['SWK05', 'Sarawak', 'Sarikei, Matu, Julau, Rajang, Daro, Bintangor, Belawai'],
  ['SWK06', 'Sarawak', 'Sri Aman, Lubok Antu, Roban, Debak, Kabong, Lingga, Engkelili, Betong, Spaoh, Pusa, Saratok'],
  ['SWK07', 'Sarawak', 'Samarahan, Serian, Simunjan, Sebuyau, Meludam'],
  ['SWK08', 'Sarawak', 'Kuching, Bau, Lundu, Sematan'],
  ['SWK09', 'Sarawak', 'Zon Khas (Kampung Patarikan)'],
  ['TRG01', 'Terengganu', 'Kuala Terengganu, Marang, Kuala Nerus'],
  ['TRG02', 'Terengganu', 'Besut, Setiu'],
  ['TRG03', 'Terengganu', 'Hulu Terengganu'],
  ['TRG04', 'Terengganu', 'Dungun, Kemaman'],
  ['WLY01', 'Wilayah Persekutuan', 'Kuala Lumpur, Putrajaya'],
  ['WLY02', 'Wilayah Persekutuan', 'Labuan'],
];

export const DEFAULT_ZONE = 'WLY01';
export const zoneInfo = code => {
  const z = ZONES.find(x => x[0] === code);
  return z ? { code: z[0], state: z[1], area: z[2] } : null;
};
// Nama pendek untuk notifikasi: kawasan pertama
export const zoneShort = code => {
  const z = zoneInfo(code);
  return z ? z.area.split(',')[0].trim() : code;
};
