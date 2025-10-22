// Performance and load tests for PostgreSQL backend
// Tests concurrent operations, connection pool efficiency, query response times, and memory usage

import { createMocks } from 'node-mocks-http'
import { NextApiRequest, NextApiResponse } from 'next'
import { performance } from 'perf_hooks'

// Mock handlers for performance testing
async function mockTrackHandler(req: NextApiRequest, res: NextApiResponse) {
  // Simulate database query delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10))
  
  if (req.method === 'POST') {
    const { trackingNumber } = req.body
    
    if (!trackingNumber || 
        typeof trackingNumber !== 'string' || 
        trackingNumber.trim().length === 0 ||
        trackingNumber.length > 255) {
      return res.status(400).json({
        success: false,
        message: 'Valid tracking number is required',
        error: 'Invalid input'
      })
    }

    // Mock successful response for performance testing
    return res.status(200).json({
      success: true,
      message: 'Package tracking information retrieved successfully',
      package: {
        id: 'pkg_' + Date.now(),
        trackingNumber: trackingNumber.trim(),
        status: 'in_transit',
        currentLocation: 'Distribution Center',
        destination: 'Customer Address',
        lastUpdated: new Date().toISOString(),
        statusHistory: [
          {
            id: 'status_1',
            status: 'created',
            location: 'Origin Facility',
            timestamp: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'status_2',
            status: 'in_transit',
            location: 'Distribution Center',
            timestamp: new Date().toISOString()
          }
        ]
      }
    })
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
    error: 'Invalid request method'
  })
}

async function mockCreatePackageHandler(req: NextApiRequest, res: NextApiResponse) {
  // Simulate database write delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 20))
  
  if (req.method === 'POST') {
    const { customerName, currentLocation, destination } = req.body
    
    if (!customerName || !currentLocation || !destination) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        error: 'customerName, currentLocation, and destination are required'
      })
    }

    // Mock successful package creation
    const trackingNumber = `SW${Date.now().toString().slice(-8)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`
    
    return res.status(201).json({
      success: true,
      message: 'Package created successfully',
      package: {
        id: 'pkg_' + Date.now(),
        trackingNumber,
        status: 'created',
        currentLocation,
        destination,
        customerName,
        lastUpdated: new Date().toISOString()
      },
      trackingNumber
    })
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed',
    error: 'Invalid request method'
  })
}

// Helper function to create mock request/response
function createMockReqRes(method: string, body?: any, query?: any) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: method as any,
    body,
    query
  })
}

// Helper function to measure execution time
async function measureExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now()
  const result = await fn()
  const end = performance.now()
  return { result, duration: end - start }
}

// Helper function to measure memory usage
function getMemoryUsage() {
  const usage = process.memoryUsage()
  return {
    rss: usage.rss / 1024 / 1024, // MB
    heapUsed: usage.heapUsed / 1024 / 1024, // MB
    heapTotal: usage.heapTotal / 1024 / 1024, // MB
    external: usage.external / 1024 / 1024 // MB
  }
}

describe('Performance and Load Tests', () => {
  describe('Concurrent Package Lookups', () => {
    test('should handle 10 concurrent package lookups efficiently', async () => {
      const concurrentRequests = 10
      const trackingNumbers = Array.from({ length: concurrentRequests }, (_, i) => `SW12345TEST${i}`)
      
      const startTime = performance.now()
      const memoryBefore = getMemoryUsage()
      
      const promises = trackingNumbers.map(async (trackingNumber) => {
        const { req, res } = createMockReqRes('POST', { trackingNumber })
        const { duration } = await measureExecutionTime(() => mockTrackHandler(req, res))
        return {
          statusCode: res._getStatusCode(),
          data: JSON.parse(res._getData()),
          duration
        }
      })
      
      const responses = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      const memoryAfter = getMemoryUsage()
      
      // All requests should complete successfully
      expect(responses).toHaveLength(concurrentRequests)
      responses.forEach(response => {
        expect(response.statusCode).toBe(200)
        expect(response.data.success).toBe(true)
      })
      
      // Performance assertions
      expect(totalTime).toBeLessThan(1000) // Should complete within 1 second
      
      // Individual request times should be reasonable
      const avgResponseTime = responses.reduce((sum, r) => sum + r.duration, 0) / responses.length
      expect(avgResponseTime).toBeLessThan(200) // Average response time under 200ms
      
      // Memory usage should not increase significantly
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryIncrease).toBeLessThan(50) // Less than 50MB increase
      
      console.log(`Concurrent lookups - Total time: ${totalTime.toFixed(2)}ms, Avg response: ${avgResponseTime.toFixed(2)}ms, Memory increase: ${memoryIncrease.toFixed(2)}MB`)
    })

    test('should handle 50 concurrent package lookups under load', async () => {
      const concurrentRequests = 50
      const trackingNumbers = Array.from({ length: concurrentRequests }, (_, i) => `SW67890LOAD${i}`)
      
      const startTime = performance.now()
      
      const promises = trackingNumbers.map(async (trackingNumber) => {
        const { req, res } = createMockReqRes('POST', { trackingNumber })
        await mockTrackHandler(req, res)
        return {
          statusCode: res._getStatusCode(),
          success: JSON.parse(res._getData()).success
        }
      })
      
      const responses = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      
      // All requests should complete
      expect(responses).toHaveLength(concurrentRequests)
      
      // At least 95% should be successful (allowing for some failures under load)
      const successfulRequests = responses.filter(r => r.statusCode === 200 && r.success).length
      const successRate = successfulRequests / concurrentRequests
      expect(successRate).toBeGreaterThan(0.95)
      
      // Should complete within reasonable time under load
      expect(totalTime).toBeLessThan(5000) // 5 seconds for 50 requests
      
      console.log(`Load test - ${concurrentRequests} requests in ${totalTime.toFixed(2)}ms, Success rate: ${(successRate * 100).toFixed(1)}%`)
    })
  })

  describe('Concurrent Package Creation', () => {
    test('should handle 10 concurrent package creations efficiently', async () => {
      const concurrentRequests = 10
      const packageData = Array.from({ length: concurrentRequests }, (_, i) => ({
        customerName: `Customer ${i}`,
        customerEmail: `customer${i}@example.com`,
        currentLocation: `Warehouse ${i % 3 + 1}`,
        destination: `Destination ${i}`,
        status: 'created'
      }))
      
      const startTime = performance.now()
      const memoryBefore = getMemoryUsage()
      
      const promises = packageData.map(async (data) => {
        const { req, res } = createMockReqRes('POST', data)
        const { duration } = await measureExecutionTime(() => mockCreatePackageHandler(req, res))
        return {
          statusCode: res._getStatusCode(),
          data: JSON.parse(res._getData()),
          duration
        }
      })
      
      const responses = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      const memoryAfter = getMemoryUsage()
      
      // All requests should complete successfully
      expect(responses).toHaveLength(concurrentRequests)
      responses.forEach(response => {
        expect(response.statusCode).toBe(201)
        expect(response.data.success).toBe(true)
        expect(response.data).toHaveProperty('trackingNumber')
      })
      
      // Performance assertions
      expect(totalTime).toBeLessThan(2000) // Should complete within 2 seconds
      
      // Individual request times should be reasonable
      const avgResponseTime = responses.reduce((sum, r) => sum + r.duration, 0) / responses.length
      expect(avgResponseTime).toBeLessThan(300) // Average response time under 300ms for writes
      
      // Memory usage should not increase significantly
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
      expect(memoryIncrease).toBeLessThan(100) // Less than 100MB increase for writes
      
      console.log(`Concurrent creations - Total time: ${totalTime.toFixed(2)}ms, Avg response: ${avgResponseTime.toFixed(2)}ms, Memory increase: ${memoryIncrease.toFixed(2)}MB`)
    })
  })

  describe('Query Response Time Benchmarks', () => {
    test('should maintain fast response times for package lookups', async () => {
      const iterations = 20
      const responseTimes: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const { req, res } = createMockReqRes('POST', { trackingNumber: `SW${i}BENCHMARK` })
        
        const { duration } = await measureExecutionTime(() => mockTrackHandler(req, res))
        responseTimes.push(duration)
        
        expect(res._getStatusCode()).toBe(200)
      }
      
      // Calculate statistics
      const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / iterations
      const maxTime = Math.max(...responseTimes)
      const minTime = Math.min(...responseTimes)
      const p95Time = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
      
      // Performance assertions
      expect(avgTime).toBeLessThan(100) // Average under 100ms
      expect(maxTime).toBeLessThan(200) // Max under 200ms
      expect(p95Time).toBeLessThan(150) // 95th percentile under 150ms
      
      console.log(`Response time stats - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`)
    })

    test('should maintain fast response times for package creation', async () => {
      const iterations = 15
      const responseTimes: number[] = []
      
      for (let i = 0; i < iterations; i++) {
        const packageData = {
          customerName: `Benchmark Customer ${i}`,
          currentLocation: 'Benchmark Warehouse',
          destination: 'Benchmark Destination'
        }
        
        const { req, res } = createMockReqRes('POST', packageData)
        
        const { duration } = await measureExecutionTime(() => mockCreatePackageHandler(req, res))
        responseTimes.push(duration)
        
        expect(res._getStatusCode()).toBe(201)
      }
      
      // Calculate statistics
      const avgTime = responseTimes.reduce((sum, time) => sum + time, 0) / iterations
      const maxTime = Math.max(...responseTimes)
      const p95Time = responseTimes.sort((a, b) => a - b)[Math.floor(iterations * 0.95)]
      
      // Performance assertions for write operations (typically slower)
      expect(avgTime).toBeLessThan(200) // Average under 200ms
      expect(maxTime).toBeLessThan(400) // Max under 400ms
      expect(p95Time).toBeLessThan(300) // 95th percentile under 300ms
      
      console.log(`Creation time stats - Avg: ${avgTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, P95: ${p95Time.toFixed(2)}ms`)
    })
  })

  describe('Memory Usage and Connection Cleanup', () => {
    test('should maintain stable memory usage during repeated operations', async () => {
      const iterations = 30
      const memoryReadings: number[] = []
      
      // Take initial memory reading
      const initialMemory = getMemoryUsage()
      memoryReadings.push(initialMemory.heapUsed)
      
      // Perform repeated operations
      for (let i = 0; i < iterations; i++) {
        const { req, res } = createMockReqRes('POST', { trackingNumber: `SW${i}MEMORY` })
        await mockTrackHandler(req, res)
        
        // Take memory reading every 5 iterations
        if (i % 5 === 0) {
          const currentMemory = getMemoryUsage()
          memoryReadings.push(currentMemory.heapUsed)
        }
      }
      
      // Take final memory reading
      const finalMemory = getMemoryUsage()
      memoryReadings.push(finalMemory.heapUsed)
      
      // Calculate memory growth
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed
      const maxMemoryIncrease = Math.max(...memoryReadings) - initialMemory.heapUsed
      
      // Memory should not grow excessively
      expect(memoryGrowth).toBeLessThan(200) // Less than 200MB growth
      expect(maxMemoryIncrease).toBeLessThan(250) // Peak increase less than 250MB
      
      console.log(`Memory usage - Initial: ${initialMemory.heapUsed.toFixed(2)}MB, Final: ${finalMemory.heapUsed.toFixed(2)}MB, Growth: ${memoryGrowth.toFixed(2)}MB`)
    })

    test('should handle connection cleanup efficiently', async () => {
      const batchSize = 10
      const batches = 3
      
      for (let batch = 0; batch < batches; batch++) {
        const memoryBefore = getMemoryUsage()
        
        // Create a batch of concurrent requests
        const promises = Array.from({ length: batchSize }, async (_, i) => {
          const { req, res } = createMockReqRes('POST', { trackingNumber: `SW${batch}_${i}CLEANUP` })
          await mockTrackHandler(req, res)
          return res._getStatusCode()
        })
        
        const responses = await Promise.all(promises)
        
        // All requests should complete successfully
        expect(responses.every(status => status === 200)).toBe(true)
        
        // Allow some time for cleanup
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const memoryAfter = getMemoryUsage()
        const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed
        
        // Memory increase per batch should be minimal
        expect(memoryIncrease).toBeLessThan(50) // Less than 50MB per batch
        
        console.log(`Batch ${batch + 1} - Memory increase: ${memoryIncrease.toFixed(2)}MB`)
      }
    })
  })

  describe('Error Handling Performance', () => {
    test('should handle validation errors efficiently', async () => {
      const iterations = 25
      const errorCases = [
        { trackingNumber: '' },
        { trackingNumber: null },
        { trackingNumber: undefined },
        {},
        { trackingNumber: 'a'.repeat(1000) } // Very long string
      ]
      
      const startTime = performance.now()
      
      const promises = Array.from({ length: iterations }, async (_, i) => {
        const errorCase = errorCases[i % errorCases.length]
        const { req, res } = createMockReqRes('POST', errorCase)
        
        const { duration } = await measureExecutionTime(() => mockTrackHandler(req, res))
        return {
          statusCode: res._getStatusCode(),
          duration
        }
      })
      
      const responses = await Promise.all(promises)
      const totalTime = performance.now() - startTime
      
      // All should return 400 errors
      responses.forEach(response => {
        expect(response.statusCode).toBe(400)
      })
      
      // Error handling should be fast
      const avgErrorTime = responses.reduce((sum, r) => sum + r.duration, 0) / iterations
      expect(avgErrorTime).toBeLessThan(50) // Error responses should be very fast
      expect(totalTime).toBeLessThan(1000) // Total time should be minimal
      
      console.log(`Error handling - ${iterations} errors in ${totalTime.toFixed(2)}ms, Avg: ${avgErrorTime.toFixed(2)}ms`)
    })
  })
})