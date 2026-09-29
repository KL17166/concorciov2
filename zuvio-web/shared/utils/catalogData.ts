import type { ProductTypeKey, SubCategoryItem } from '../types/catalog'

// Categorias e subcategorias canônicas do sistema (alinhadas 1:1 com o banco de dados / server-consorcio)
export const PRODUCT_CATEGORIES: { key: ProductTypeKey; label: string; subCategories: SubCategoryItem[] }[] = [
  { key: 'TODOS', label: 'Todos', subCategories: [] },
  {
    key: 'MOTO',
    label: 'Motos',
    subCategories: [
      { key: 'esportiva', displayName: 'Esportiva', icon: '' },
      { key: 'naked', displayName: 'Naked', icon: '' },
      { key: 'urbana', displayName: 'Urbana', icon: '' },
      { key: 'trail', displayName: 'Trail', icon: '' },
      { key: 'custom', displayName: 'Custom', icon: '' },
      { key: 'scooter', displayName: 'Scooter', icon: '' },
      { key: 'adventure', displayName: 'Adventure', icon: '' },
      { key: 'touring', displayName: 'Touring', icon: '' },
      { key: 'street', displayName: 'Street', icon: '' }
    ]
  },
  {
    key: 'CARRO',
    label: 'Carros',
    subCategories: [
      { key: 'suv', displayName: 'SUV', icon: '' },
      { key: 'hatch', displayName: 'Hatch', icon: '' },
      { key: 'sedan', displayName: 'Sedan', icon: '' },
      { key: 'picape', displayName: 'Picape', icon: '' },
      { key: 'esportivo', displayName: 'Esportivo', icon: '' },
      { key: 'outros', displayName: 'Outros', icon: '' }
    ]
  },
  {
    key: 'CARTA_CREDITO',
    label: 'Cartas de Crédito',
    subCategories: [
      { key: 'geral', displayName: 'Uso geral', icon: '' },
      { key: 'veiculo', displayName: 'Veículos', icon: '' },
      { key: 'imovel', displayName: 'Imóveis', icon: '' },
      { key: 'premium', displayName: 'Premium', icon: '' }
    ]
  },
  {
    key: 'ELETRONICO',
    label: 'Eletrônicos',
    subCategories: [
      { key: 'gaming', displayName: 'Gaming', icon: '' },
      { key: 'notebook', displayName: 'Notebook', icon: '' },
      { key: 'smartphone', displayName: 'Smartphone', icon: '' },
      { key: 'tablet', displayName: 'Tablet', icon: '' },
      { key: 'outros', displayName: 'Outros', icon: '' }
    ]
  },
  {
    key: 'IMOVEL',
    label: 'Imóveis',
    subCategories: [
      { key: 'residencial', displayName: 'Residencial', icon: '' },
      { key: 'comercial', displayName: 'Comercial', icon: '' },
      { key: 'terreno', displayName: 'Terreno', icon: '' },
      { key: 'rural', displayName: 'Rural', icon: '' }
    ]
  },
  {
    key: 'SERVICO',
    label: 'Serviços',
    subCategories: [
      { key: 'educacao', displayName: 'Educação', icon: '' },
      { key: 'viagem', displayName: 'Viagem', icon: '' },
      { key: 'saude', displayName: 'Saúde', icon: '' },
      { key: 'consultoria', displayName: 'Consultoria', icon: '' },
      { key: 'outros', displayName: 'Outros', icon: '' }
    ]
  }
]
