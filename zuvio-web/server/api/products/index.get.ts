// GET /api/products
import { defineEventHandler, getQuery } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { Product } from '~~/shared/types/catalog'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const params = query.type ? `?type=${query.type}` : ''
  return proxyToBackend<Product[]>(event, `/api/products${params}`, {
    method: 'GET',
    forwardAuth: false
  })
})
