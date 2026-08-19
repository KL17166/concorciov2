// GET /api/products/:id
import { defineEventHandler, getRouterParam } from 'h3'
import { proxyToBackend } from '../../utils/backendProxy'
import type { Product } from '~~/shared/types/catalog'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  return proxyToBackend<Product>(event, `/api/products/${id}`, {
    method: 'GET',
    forwardAuth: false
  })
})
