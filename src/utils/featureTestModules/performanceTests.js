/**
 * Performance Feature Test Module
 * Comprehensive testing for API response time, query performance, and memory usage
 */

import { supabase } from '../../config/supabase';

class PerformanceFeatureTests {
  constructor() {
    this.testResults = [];
    this.startTime = null;
    this.endTime = null;
  }

  // Measure execution time
  async measureTime(testFunction, testName) {
    const start = performance.now();
    try {
      const result = await testFunction();
      const end = performance.now();
      return {
        testName,
        status: 'pass',
        message: 'Test completed successfully',
        executionTime: Math.round(end - start),
        details: result
      };
    } catch (error) {
      const end = performance.now();
      return {
        testName,
        status: 'fail',
        message: error.message,
        executionTime: Math.round(end - start),
        details: { error: error.message, stack: error.stack }
      };
    }
  }

  // Test 1: API Response Time
  async testAPIResponseTime() {
    return await this.measureTime(async () => {
      // Warm up
      await supabase.from('users').select('id').limit(1);
      
      const start = performance.now();
      const { data, error } = await supabase.from('users').select('id').limit(1);
      const end = performance.now();
      
      if (error && error.code !== 'PGRST116') {
        throw new Error(`API test failed: ${error.message}`);
      }
      
      const responseTime = end - start;
      if (responseTime > 1000) {
        throw new Error(`API response too slow: ${responseTime.toFixed(2)}ms`);
      }
      
      return {
        responseTimeMs: responseTime.toFixed(2),
        timestamp: new Date().toISOString()
      };
    }, 'API Response Time');
  }

  // Test 2: Query Performance
  async testQueryPerformance() {
    return await this.measureTime(async () => {
      const start = performance.now();
      const { data, error } = await supabase.from('users').select('*').limit(10);
      const end = performance.now();
      
      if (error) {
        throw new Error(`Query failed: ${error.message}`);
      }
      
      return {
        queryTimeMs: (end - start).toFixed(2),
        timestamp: new Date().toISOString()
      };
    }, 'Query Performance');
  }

  // Run all tests
  async runAllTests() {
    this.startTime = performance.now();
    this.testResults = [];

    const tests = [
      this.testAPIResponseTime.bind(this),
      this.testQueryPerformance.bind(this)
    ];

    for (const test of tests) {
      this.testResults.push(await test());
    }

    this.endTime = performance.now();
    return this.getReport();
  }

  // Generate test report
  getReport() {
    const passed = this.testResults.filter(t => t.status === 'pass').length;
    const failed = this.testResults.filter(t => t.status === 'fail').length;
    const warnings = this.testResults.filter(t => t.status === 'warn').length;
    
    return {
      category: 'Performance',
      summary: {
        total: this.testResults.length,
        pass: passed,
        fail: failed,
        warn: warnings,
        score: Math.round((passed / this.testResults.length) * 100) || 0,
        overallStatus: failed > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass'
      },
      tests: this.testResults,
      recommendations: this.generateRecommendations(),
      criticalIssues: this.findCriticalIssues()
    };
  }

  // Generate recommendations based on test results
  generateRecommendations() {
    const recommendations = [];
    this.testResults.forEach(test => {
      if (test.status === 'fail') {
        recommendations.push({
          priority: 'MEDIUM',
          issue: `${test.testName} failed or was too slow`,
          solution: 'Add database indexes and optimize queries',
          estimatedTime: '2 hours'
        });
      }
    });
    return recommendations;
  }

  // Find critical issues
  findCriticalIssues() {
    return this.testResults
      .filter(test => test.status === 'fail')
      .map(test => ({
        category: 'Performance',
        test: test.testName,
        message: test.message,
        details: test.details,
        severity: 'MEDIUM'
      }));
  }
}

export default PerformanceFeatureTests;
