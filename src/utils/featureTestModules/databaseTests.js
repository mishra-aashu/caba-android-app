/**
 * Database Feature Test Module
 * Comprehensive testing for database connectivity and operations
 */

import { supabase } from '../../config/supabase';

class DatabaseFeatureTests {
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

  // Test 1: Basic Database Connection
  async testBasicConnection() {
    return await this.measureTime(async () => {
      const { data, error } = await supabase.from('users').select('count').single();
      
      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }
      
      return {
        connected: true,
        count: data?.count || 0,
        timestamp: new Date().toISOString()
      };
    }, 'Basic Database Connection');
  }

  // Test 2: Connection Pool Performance
  async testConnectionPool() {
    return await this.measureTime(async () => {
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () => 
        supabase.from('users').select('count').single()
      );
      
      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);
      const successCount = results.length - errors.length;
      
      if (successCount < concurrentRequests * 0.8) {
        throw new Error(`Connection pool issue: Only ${successCount}/${concurrentRequests} requests succeeded`);
      }
      
      return {
        totalRequests: concurrentRequests,
        successful: successCount,
        failed: errors.length,
        successRate: Math.round((successCount / concurrentRequests) * 100),
        errors: errors.map(e => e.error?.message).filter(Boolean)
      };
    }, 'Connection Pool Performance');
  }

  // Test 3: Database Schema Validation
  async testDatabaseSchema() {
    return await this.measureTime(async () => {
      const requiredTables = [
        'users',
        'messages', 
        'chats',
        'admin_logs',
        'reports',
        'news_articles',
        'groups',
        'reminders',
        'statuses',
        'media_transfers',
        'system_settings',
        'blocked_users',
        'group_members'
      ];
      
      const schemaResults = [];
      
      for (const tableName of requiredTables) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
          
          schemaResults.push({
            table: tableName,
            accessible: !error,
            hasData: !!(data && data.length > 0),
            error: error?.message
          });
        } catch (error) {
          schemaResults.push({
            table: tableName,
            accessible: false,
            hasData: false,
            error: error.message
          });
        }
      }
      
      const inaccessibleTables = schemaResults.filter(r => !r.accessible);
      if (inaccessibleTables.length > 0) {
        throw new Error(`${inaccessibleTables.length} tables are not accessible: ${inaccessibleTables.map(t => t.table).join(', ')}`);
      }
      
      return {
        totalTables: requiredTables.length,
        accessibleTables: schemaResults.filter(r => r.accessible).length,
        tablesWithData: schemaResults.filter(r => r.hasData).length,
        schemaResults
      };
    }, 'Database Schema Validation');
  }

  // Test 4: Query Performance Analysis
  async testQueryPerformance() {
    return await this.measureTime(async () => {
      const queries = [
        {
          name: 'Simple Count Query',
          query: () => supabase.from('users').select('count').single()
        },
        {
          name: 'Complex Join Query',
          query: () => supabase
            .from('messages')
            .select(`
              *,
              sender:users(name, email),
              receiver:users(name, email)
            `)
            .limit(10)
        },
        {
          name: 'Aggregation Query',
          query: () => supabase
            .from('users')
            .select('id, created_at')
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        },
        {
          name: 'Full Text Search',
          query: () => supabase
            .from('users')
            .select('*')
            .ilike('name', '%test%')
            .limit(5)
        }
      ];
      
      const performanceResults = [];
      
      for (const queryTest of queries) {
        const start = performance.now();
        try {
          const { data, error } = await queryTest.query();
          const end = performance.now();
          
          performanceResults.push({
            query: queryTest.name,
            executionTime: Math.round(end - start),
            success: !error,
            recordCount: Array.isArray(data) ? data.length : (data ? 1 : 0),
            error: error?.message
          });
        } catch (error) {
          const end = performance.now();
          performanceResults.push({
            query: queryTest.name,
            executionTime: Math.round(end - start),
            success: false,
            recordCount: 0,
            error: error.message
          });
        }
      }
      
      const slowQueries = performanceResults.filter(r => r.executionTime > 1000);
      if (slowQueries.length > 0) {
        throw new Error(`${slowQueries.length} queries are slow (>1s): ${slowQueries.map(q => q.query).join(', ')}`);
      }
      
      return {
        totalQueries: queries.length,
        successfulQueries: performanceResults.filter(r => r.success).length,
        averageExecutionTime: Math.round(performanceResults.reduce((acc, r) => acc + r.executionTime, 0) / performanceResults.length),
        slowQueries: slowQueries.length,
        performanceResults
      };
    }, 'Query Performance Analysis');
  }

  // Test 5: Data Integrity Checks
  async testDataIntegrity() {
    return await this.measureTime(async () => {
      const integrityChecks = [];
      
      // Check for orphaned records
      try {
        const { data: orphanedMessages, error } = await supabase
          .from('messages')
          .select('id, sender_id')
          .not('sender_id', 'in', '(SELECT id FROM users)')
          .limit(10);
        
        integrityChecks.push({
          check: 'Orphaned Messages',
          status: error ? 'error' : orphanedMessages.length > 0 ? 'warning' : 'pass',
          count: orphanedMessages?.length || 0,
          details: error?.message
        });
      } catch (error) {
        integrityChecks.push({
          check: 'Orphaned Messages',
          status: 'error',
          count: 0,
          details: error.message
        });
      }
      
      // Check for null critical fields
      try {
        const { data: usersWithNulls, error } = await supabase
          .from('users')
          .select('id, email, name')
          .or('email.is.null,name.is.null')
          .limit(10);
        
        integrityChecks.push({
          check: 'Null Critical Fields',
          status: error ? 'error' : usersWithNulls.length > 0 ? 'warning' : 'pass',
          count: usersWithNulls?.length || 0,
          details: error?.message
        });
      } catch (error) {
        integrityChecks.push({
          check: 'Null Critical Fields',
          status: 'error',
          count: 0,
          details: error.message
        });
      }
      
      // Check for duplicate emails
      try {
        const { data: duplicateEmails, error } = await supabase
          .from('users')
          .select('email')
          .not('email', 'is', null)
          .group('email')
          .having('count', 'gt', 1)
          .limit(5);
        
        integrityChecks.push({
          check: 'Duplicate Emails',
          status: error ? 'error' : duplicateEmails.length > 0 ? 'warning' : 'pass',
          count: duplicateEmails?.length || 0,
          details: error?.message
        });
      } catch (error) {
        integrityChecks.push({
          check: 'Duplicate Emails',
          status: 'error',
          count: 0,
          details: error.message
        });
      }
      
      const issues = integrityChecks.filter(c => c.status === 'warning' || c.status === 'error');
      if (issues.length > 0) {
        throw new Error(`Data integrity issues found: ${issues.map(i => i.check).join(', ')}`);
      }
      
      return {
        totalChecks: integrityChecks.length,
        passedChecks: integrityChecks.filter(c => c.status === 'pass').length,
        issuesFound: issues.length,
        integrityChecks
      };
    }, 'Data Integrity Checks');
  }

  // Test 6: Transaction Support
  async testTransactionSupport() {
    return await this.measureTime(async () => {
      // This test would require RPC functions that support transactions
      // For now, we'll test basic insert/delete operations
      try {
        // Create a test record
        const { data: testData, error: insertError } = await supabase
          .from('admin_logs')
          .insert({
            admin_id: 'test-admin-id',
            action: 'test_transaction',
            details: { test: true },
            ip_address: '127.0.0.1',
            user_agent: 'test-agent'
          })
          .select()
          .single();
        
        if (insertError) {
          throw new Error(`Insert failed: ${insertError.message}`);
        }
        
        // Delete the test record
        const { error: deleteError } = await supabase
          .from('admin_logs')
          .delete()
          .eq('id', testData.id);
        
        if (deleteError) {
          throw new Error(`Delete failed: ${deleteError.message}`);
        }
        
        return {
          insertSuccessful: true,
          deleteSuccessful: true,
          testRecordId: testData.id,
          message: 'Transaction operations working correctly'
        };
      } catch (error) {
        throw new Error(`Transaction test failed: ${error.message}`);
      }
    }, 'Transaction Support');
  }

  // Test 7: Database Size and Limits
  async testDatabaseSize() {
    return await this.measureTime(async () => {
      try {
        // Try to get database size (might require RPC function)
        const { data, error } = await supabase.rpc('get_database_size');
        
        if (error) {
          // Fallback: estimate size from table counts
          const tableSizes = {};
          const tables = ['users', 'messages', 'chats', 'admin_logs', 'media'];
          
          for (const table of tables) {
            try {
              const { count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
              tableSizes[table] = count || 0;
            } catch (e) {
              tableSizes[table] = 0;
            }
          }
          
          return {
            sizeAvailable: false,
            estimatedRecords: tableSizes,
            totalEstimatedRecords: Object.values(tableSizes).reduce((acc, count) => acc + count, 0),
            message: 'Database size not available, estimated record counts provided'
          };
        }
        
        return {
          sizeAvailable: true,
          sizeInMB: data,
          message: `Database size: ${data} MB`
        };
      } catch (error) {
        throw new Error(`Database size check failed: ${error.message}`);
      }
    }, 'Database Size and Limits');
  }

  // Test 8: Index Performance
  async testIndexPerformance() {
    return await this.measureTime(async () => {
      const indexTests = [];
      
      // Test indexed queries vs non-indexed
      try {
        // Test with indexed field (id)
        const start1 = performance.now();
        const { data: indexedResult, error: indexedError } = await supabase
          .from('users')
          .select('*')
          .eq('id', 'test-id')
          .limit(1);
        const end1 = performance.now();
        
        indexTests.push({
          query: 'Indexed Query (id)',
          executionTime: Math.round(end1 - start1),
          success: !indexedError,
          recordCount: indexedResult?.length || 0
        });
        
        // Test with potentially non-indexed field
        const start2 = performance.now();
        const { data: nonIndexedResult, error: nonIndexedError } = await supabase
          .from('users')
          .select('*')
          .ilike('name', '%test%')
          .limit(10);
        const end2 = performance.now();
        
        indexTests.push({
          query: 'Non-Indexed Query (name)',
          executionTime: Math.round(end2 - start2),
          success: !nonIndexedError,
          recordCount: nonIndexedResult?.length || 0
        });
        
        const slowQueries = indexTests.filter(t => t.executionTime > 500);
        
        return {
          totalTests: indexTests.length,
          successfulTests: indexTests.filter(t => t.success).length,
          averageExecutionTime: Math.round(indexTests.reduce((acc, t) => acc + t.executionTime, 0) / indexTests.length),
          slowQueries: slowQueries.length,
          indexTests,
          recommendations: slowQueries.length > 0 ? 'Consider adding indexes for frequently queried fields' : 'Index performance is good'
        };
      } catch (error) {
        throw new Error(`Index performance test failed: ${error.message}`);
      }
    }, 'Index Performance');
  }

  // Run all database tests
  async runAllTests() {
    this.startTime = performance.now();
    this.testResults = [];
    
    const tests = [
      this.testBasicConnection(),
      this.testConnectionPool(),
      this.testDatabaseSchema(),
      this.testQueryPerformance(),
      this.testDataIntegrity(),
      this.testTransactionSupport(),
      this.testDatabaseSize(),
      this.testIndexPerformance()
    ];
    
    try {
      const results = await Promise.all(tests);
      this.testResults = results;
      this.endTime = performance.now();
      
      return this.generateReport();
    } catch (error) {
      this.endTime = performance.now();
      throw error;
    }
  }

  // Generate test report
  generateReport() {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(t => t.status === 'pass').length;
    const failedTests = this.testResults.filter(t => t.status === 'fail').length;
    const totalExecutionTime = Math.round(this.endTime - this.startTime);
    
    const summary = {
      category: 'Database',
      totalTests,
      passed: passedTests,
      failed: failedTests,
      score: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      executionTime: totalExecutionTime,
      status: failedTests > 0 ? 'fail' : 'pass'
    };
    
    return {
      summary,
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
        switch (test.testName) {
          case 'Basic Database Connection':
            recommendations.push({
              priority: 'CRITICAL',
              issue: 'Database connection failing',
              solution: 'Check Supabase credentials, network connectivity, and service status',
              estimatedTime: '30 minutes'
            });
            break;
          case 'Connection Pool Performance':
            recommendations.push({
              priority: 'HIGH',
              issue: 'Connection pool performance issues',
              solution: 'Review connection limits and optimize database connections',
              estimatedTime: '1 hour'
            });
            break;
          case 'Database Schema Validation':
            recommendations.push({
              priority: 'HIGH',
              issue: 'Database schema issues',
              solution: 'Review table permissions and ensure all required tables exist',
              estimatedTime: '2 hours'
            });
            break;
          case 'Query Performance Analysis':
            recommendations.push({
              priority: 'MEDIUM',
              issue: 'Slow database queries detected',
              solution: 'Add appropriate indexes and optimize query structure',
              estimatedTime: '3 hours'
            });
            break;
          case 'Data Integrity Checks':
            recommendations.push({
              priority: 'HIGH',
              issue: 'Data integrity issues found',
              solution: 'Clean up orphaned records and fix null critical fields',
              estimatedTime: '4 hours'
            });
            break;
          default:
            recommendations.push({
              priority: 'MEDIUM',
              issue: `${test.testName} failed`,
              solution: 'Review test details and investigate the underlying issue',
              estimatedTime: '1 hour'
            });
        }
      }
    });
    
    return recommendations;
  }

  // Find critical issues
  findCriticalIssues() {
    return this.testResults
      .filter(test => test.status === 'fail')
      .map(test => ({
        category: 'Database',
        test: test.testName,
        message: test.message,
        details: test.details,
        severity: 'HIGH'
      }));
  }
}

export default DatabaseFeatureTests;
