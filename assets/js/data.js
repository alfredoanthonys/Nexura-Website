/*
 * Nexura home page content.
 * Edit products, prices and the video here. No design work needed.
 *
 * Product fields
 *   featured   shown in the first row of "Produk Andalan"; the rest appear after "Lihat Produk Lainnya"
 *   price      in Rupiah, integer. A colour can override it (see FrostSpire Silver)
 *   compareAt  original price, shown crossed out. Leave out when there is no real original price
 *   stock      "in" | "low" (badge "Stok terakhir") | "out" (badge "Restock segera", button disabled)
 *   colors     each colour points at an image in assets/img (without -800.webp / .jpg)
 *   image      used when a product has no colour options
 */
window.NEXURA = {
  categories: {
    'fan-cooler': 'Fan Cooler',
    'sarung-jempol': 'Sarung Jempol',
    'hydrogel': 'Hydrogel',
  },

  products: [
    {
      id: 'iceglow',
      featured: true,
      category: 'fan-cooler',
      name: 'NEXURA Fan Cooler IceGlow NXI01 | Pendingin HP 15W Mode AI & Digital Display',
      short: 'IceGlow NXI01',
      price: 159000,
      compareAt: 219000,
      stock: 'in',
      keywords: 'kipas pendingin cooler hp ai rgb 15w',
      colors: [
        { id: 'ungu', label: 'Ungu', swatch: '#7B3FE4', image: 'p-iceglow-ungu' },
        { id: 'pink', label: 'Pink', swatch: '#F0A6D6', image: 'p-iceglow-pink' },
        { id: 'hitam', label: 'Hitam', swatch: '#1C1922', image: 'p-iceglow-hitam' },
      ],
      alt: 'Fan cooler Nexura IceGlow NXI01',
    },
    {
      id: 'frostbyte',
      featured: true,
      category: 'fan-cooler',
      name: 'NEXURA Fan Cooler Frostbyte NXC01 | Pendingin HP 27W 3 Level Digital Display',
      short: 'Frostbyte NXC01',
      price: 139000,
      compareAt: 200000,
      stock: 'low',
      keywords: 'kipas pendingin cooler hp 27w',
      colors: [
        { id: 'ungu', label: 'Ungu', swatch: '#7B3FE4', image: 'p-frostbyte-ungu' },
        { id: 'putih', label: 'Putih', swatch: '#EDEAF2', image: 'p-frostbyte-varian' },
        { id: 'hitam', label: 'Hitam', swatch: '#1C1922', image: 'p-frostbyte-varian' },
      ],
      alt: 'Fan cooler Nexura Frostbyte NXC01',
    },
    {
      id: 'vortex',
      featured: true,
      category: 'sarung-jempol',
      name: 'NEXURA Sarung Jempol Vortex | Thumb Sleeve Gaming Anti Keringat',
      short: 'Vortex',
      price: 19500,
      compareAt: 49000,
      stock: 'in',
      keywords: 'sarung jempol thumb sleeve finger',
      colors: [
        { id: 'merah', label: 'Merah', swatch: '#E0393E', image: 'p-vortex' },
        { id: 'biru', label: 'Biru', swatch: '#2F7DF6', image: 'p-vortex' },
        { id: 'ungu', label: 'Ungu', swatch: '#7B3FE4', image: 'p-vortex' },
      ],
      alt: 'Sarung jempol Nexura Vortex warna ungu, biru, dan merah',
    },
    {
      id: 'hydrogel-matte',
      featured: true,
      category: 'hydrogel',
      name: 'NEXURA Hydrogel Matte | Pelindung Layar Anti Silau untuk Gaming',
      short: 'Hydrogel Matte',
      price: 69000,
      compareAt: 99000,
      stock: 'in',
      keywords: 'hydrogel anti gores screen protector pelindung layar matte',
      note: 'Untuk berbagai tipe HP',
      image: 'p-hydrogel-matte',
      alt: 'Pelindung layar Nexura Hydrogel Matte',
    },
    {
      id: 'frostspire',
      featured: false,
      category: 'fan-cooler',
      name: 'NEXURA Fan Cooler FrostSpire NXC10 | Pendingin HP 27W Premium Design',
      short: 'FrostSpire NXC10',
      price: 199000,
      stock: 'out',
      keywords: 'kipas pendingin cooler hp 27w',
      colors: [
        { id: 'hitam', label: 'Hitam', swatch: '#1C1922', image: 'p-frostspire-hitam' },
        { id: 'silver', label: 'Silver', swatch: '#C9CCD3', image: 'p-frostspire-silver', price: 195000 },
      ],
      alt: 'Fan cooler Nexura FrostSpire NXC10',
    },
    {
      id: 'hydrogel-clear',
      featured: false,
      category: 'hydrogel',
      name: 'NEXURA Hydrogel Clear HD | Pelindung Layar Jernih Anti Gores',
      short: 'Hydrogel Clear HD',
      price: 69000,
      compareAt: 99000,
      stock: 'in',
      keywords: 'hydrogel anti gores screen protector pelindung layar bening clear',
      note: 'Untuk berbagai tipe HP',
      image: 'p-hydrogel-clear',
      alt: 'Pelindung layar Nexura Hydrogel Clear HD',
    },
  ],

  // Compilation video for "Apa Kata Streamers". Paste the YouTube video ID (the part after v=).
  video: {
    youtubeId: '',
    title: 'Kompilasi streamer pakai Nexura',
  },
};
