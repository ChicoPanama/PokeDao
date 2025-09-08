// For now, we'll just export a placeholder until we need actual DB integration
export const prisma = {
  card: {
    findMany: () => Promise.resolve([]),
    count: () => Promise.resolve(0),
    createMany: () => Promise.resolve({ count: 0 }),
    aggregate: () => Promise.resolve({ _count: { price: 0 }, _min: { price: 0 }, _max: { price: 0 }, _avg: { price: 0 } })
  },
  $disconnect: () => Promise.resolve()
}

export default prisma
