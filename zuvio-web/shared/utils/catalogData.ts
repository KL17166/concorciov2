import type { Product, ProductTypeKey, SubCategoryItem } from '../types/catalog'

export const PRODUCT_CATEGORIES: { key: ProductTypeKey; label: string; subCategories: SubCategoryItem[] }[] = [
  { key: 'TODOS', label: 'Todos', subCategories: [] },
  {
    key: 'MOTO',
    label: 'Motos',
    subCategories: [
      { key: 'sport', displayName: 'Esportiva', icon: '🏍️' },
      { key: 'trail', displayName: 'Trail', icon: '🏔️' },
      { key: 'custom', displayName: 'Custom', icon: '🦅' },
      { key: 'urbana', displayName: 'Urbana', icon: '🏙️' },
      { key: 'scooter', displayName: 'Scooter', icon: '🛵' },
      { key: 'touring', displayName: 'Touring', icon: '🗺️' }
    ]
  },
  {
    key: 'CARRO',
    label: 'Carros',
    subCategories: [
      { key: 'sedan', displayName: 'Sedan', icon: '🚗' },
      { key: 'suv', displayName: 'SUV', icon: '🚙' },
      { key: 'hatch', displayName: 'Hatch', icon: '🚘' },
      { key: 'pickup', displayName: 'Pickup', icon: '🛻' },
      { key: 'esportivo', displayName: 'Esportivo', icon: '🏎️' }
    ]
  },
  {
    key: 'CARTA_CREDITO',
    label: 'Cartas de Crédito',
    subCategories: [
      { key: 'veiculo', displayName: 'Veículo', icon: '💳' },
      { key: 'imovel', displayName: 'Imóvel', icon: '🏠' },
      { key: 'servicos', displayName: 'Serviços', icon: '🛠️' },
      { key: 'livre', displayName: 'Livre', icon: '✨' }
    ]
  },
  {
    key: 'ELETRONICO',
    label: 'Eletrônicos',
    subCategories: [
      { key: 'celular', displayName: 'Celular', icon: '📱' },
      { key: 'notebook', displayName: 'Notebook', icon: '💻' },
      { key: 'gaming', displayName: 'Gaming', icon: '🎮' },
      { key: 'tv', displayName: 'TV', icon: '📺' }
    ]
  },
  {
    key: 'IMOVEL',
    label: 'Imóveis',
    subCategories: [
      { key: 'casa', displayName: 'Casa', icon: '🏡' },
      { key: 'apartamento', displayName: 'Apartamento', icon: '🏢' },
      { key: 'terreno', displayName: 'Terreno', icon: '🏞️' }
    ]
  },
  {
    key: 'SERVICO',
    label: 'Serviços',
    subCategories: [
      { key: 'reforma', displayName: 'Reforma', icon: '🔨' },
      { key: 'viagem', displayName: 'Viagem', icon: '✈️' },
      { key: 'educacao', displayName: 'Educação', icon: '🎓' }
    ]
  }
]

export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    name: 'Honda CG 160 Titan',
    imageUrl: 'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=1200',
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
      'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200',
      'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'
    ],
    price: 18500,
    active: true,
    description: 'A moto mais vendida do Brasil. Econômica, robusta e com excelente valor de revenda.',
    type: 'MOTO',
    category: 'urbana',
    isFeatured: true,
    isPopular: true,
    brand: 'Honda',
    model: 'CG 160 Titan',
    year: 2024,
    minDuration: 36,
    maxDuration: 80,
    specs: {
      engineType: 'Monocilíndrico 4T OHC',
      displacement: '162.7 cc',
      power: '15.1 cv a 8.000 rpm',
      torque: '1.54 kgf.m a 6.000 rpm',
      transmission: '5 velocidades',
      frontBrake: 'Disco hidráulico 240mm (CBS)',
      rearBrake: 'Tambor 130mm',
      weight: '117 kg',
      fuelCapacity: '16.1 litros',
      consumption: '41.0 km/l'
    },
    plans: [
      { id: 'plan_1_1', durationMonths: 36, monthlyInstallment: 589.90 },
      { id: 'plan_1_2', durationMonths: 50, monthlyInstallment: 432.50 },
      { id: 'plan_1_3', durationMonths: 80, monthlyInstallment: 289.90 }
    ]
  },
  {
    id: 'prod_2',
    name: 'Yamaha MT-03 ABS',
    imageUrl: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200',
      'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=1200',
      'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200',
      'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200'
    ],
    price: 32900,
    active: true,
    description: 'Design agressivo no conceito Dark Side of Japan. Motor bicilíndrico de 321cc com performance espetacular.',
    type: 'MOTO',
    category: 'sport',
    isFeatured: true,
    isPopular: true,
    brand: 'Yamaha',
    model: 'MT-03',
    year: 2024,
    minDuration: 36,
    maxDuration: 72,
    specs: {
      engineType: 'Bicilíndrico DOHC 8V',
      displacement: '321 cc',
      power: '42.0 cv a 10.750 rpm',
      torque: '3.0 kgf.m a 9.000 rpm',
      transmission: '6 velocidades',
      frontBrake: 'Disco hidráulico 298mm ABS',
      rearBrake: 'Disco hidráulico 220mm ABS',
      weight: '169 kg',
      fuelCapacity: '14.0 litros',
      consumption: '22.5 km/l'
    },
    plans: [
      { id: 'plan_2_1', durationMonths: 36, monthlyInstallment: 1020.00 },
      { id: 'plan_2_2', durationMonths: 50, monthlyInstallment: 748.00 },
      { id: 'plan_2_3', durationMonths: 72, monthlyInstallment: 539.00 }
    ]
  },
  {
    id: 'prod_3',
    name: 'Honda CB 500X ABS',
    imageUrl: 'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200',
      'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
      'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=1200'
    ],
    price: 43500,
    active: true,
    description: 'A crossover perfeita para encarar qualquer viagem ou cidade com conforto e suspensão invertida.',
    type: 'MOTO',
    category: 'trail',
    isFeatured: false,
    isPopular: true,
    brand: 'Honda',
    model: 'CB 500X',
    year: 2024,
    minDuration: 48,
    maxDuration: 84,
    specs: {
      engineType: 'Dois cilindros paralelos DOHC',
      displacement: '471 cc',
      power: '50.4 cv a 8.500 rpm',
      torque: '4.55 kgf.m a 6.500 rpm',
      transmission: '6 velocidades com embreagem assistida',
      frontBrake: 'Duplo disco 296mm ABS',
      rearBrake: 'Disco 240mm ABS',
      weight: '184 kg',
      fuelCapacity: '17.7 litros',
      consumption: '27.8 km/l'
    },
    plans: [
      { id: 'plan_3_1', durationMonths: 48, monthlyInstallment: 1045.00 },
      { id: 'plan_3_2', durationMonths: 60, monthlyInstallment: 849.00 },
      { id: 'plan_3_3', durationMonths: 84, monthlyInstallment: 635.00 }
    ]
  },
  {
    id: 'prod_4',
    name: 'BMW G 310 GS',
    imageUrl: 'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1599819811279-d5ad9cccf838?w=1200',
      'https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=1200',
      'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=1200'
    ],
    price: 38900,
    active: true,
    description: 'Espírito GS para todos os dias. Aventure-se na cidade ou no off-road com a engenharia BMW.',
    type: 'MOTO',
    category: 'trail',
    isFeatured: true,
    isPopular: false,
    brand: 'BMW',
    model: 'G 310 GS',
    year: 2024,
    minDuration: 36,
    maxDuration: 72,
    specs: {
      engineType: 'Monocilíndrico 4T refrigeração líquida',
      displacement: '313 cc',
      power: '34.0 cv a 9.250 rpm',
      torque: '2.8 kgf.m a 7.500 rpm',
      transmission: '6 velocidades',
      frontBrake: 'Disco simples 300mm com pinça radial ByBre',
      rearBrake: 'Disco simples 240mm ABS',
      weight: '175 kg',
      fuelCapacity: '11.5 litros',
      consumption: '30.3 km/l'
    },
    plans: [
      { id: 'plan_4_1', durationMonths: 36, monthlyInstallment: 1199.00 },
      { id: 'plan_4_2', durationMonths: 60, monthlyInstallment: 765.00 },
      { id: 'plan_4_3', durationMonths: 72, monthlyInstallment: 649.00 }
    ]
  },
  {
    id: 'prod_5',
    name: 'Royal Enfield Hunter 350',
    imageUrl: 'https://images.unsplash.com/photo-1615172282427-9a57ef2d142e?w=800',
    imageUrls: [
      'https://images.unsplash.com/photo-1615172282427-9a57ef2d142e?w=1200',
      'https://images.unsplash.com/photo-1558981852-426c6c22a060?w=1200',
      'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200'
    ],
    price: 19990,
    active: true,
    description: 'Estilo clássico contemporâneo e torque suave para dominar as ruas com personalidade única.',
    type: 'MOTO',
    category: 'custom',
    isFeatured: false,
    isPopular: true,
    brand: 'Royal Enfield',
    model: 'Hunter 350',
    year: 2024,
    minDuration: 36,
    maxDuration: 60,
    specs: {
      engineType: 'Monocilíndrico 4T ar/óleo J-Series',
      displacement: '349 cc',
      power: '20.2 cv a 6.100 rpm',
      torque: '2.75 kgf.m a 4.000 rpm',
      transmission: '5 marchas',
      frontBrake: 'Disco 300mm ABS de canal duplo',
      rearBrake: 'Disco 270mm ABS',
      weight: '181 kg',
      fuelCapacity: '13.0 litros',
      consumption: '36.2 km/l'
    },
    plans: [
      { id: 'plan_5_1', durationMonths: 36, monthlyInstallment: 620.00 },
      { id: 'plan_5_2', durationMonths: 48, monthlyInstallment: 479.00 },
      { id: 'plan_5_3', durationMonths: 60, monthlyInstallment: 389.00 }
    ]
  }
]
