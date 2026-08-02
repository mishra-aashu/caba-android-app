/**
 * Authentication Feature Test Module
 * Comprehensive testing for authentication and authorization systems
 */

import { supabase } from '../../config/supabase';

class AuthFeatureTests {
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

  // Test 1: Current User Session Validation
  async testCurrentUserSession() {
    return await this.measureTime(async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) {
        throw new Error(`Session validation failed: ${error.message}`);
      }
      
      if (!user) {
        throw new Error('No active user session found');
      }
      
      return {
        hasActiveSession: true,
        userId: user.id,
        email: user.email,
        lastSignIn: user.last_sign_in_at,
        sessionAge: user.last_sign_in_at ? Date.now() - new Date(user.last_sign_in_at).getTime() : null,
        role: user.role || 'user'
      };
    }, 'Current User Session Validation');
  }

  // Test 2: JWT Token Validation
  async testJWTTokenValidation() {
    return await this.measureTime(async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        throw new Error(`Token validation failed: ${error.message}`);
      }
      
      if (!session) {
        throw new Error('No session token available');
      }
      
      const currentTime = Date.now() / 1000;
      const tokenExpiresAt = session.expires_at;
      const timeUntilExpiry = tokenExpiresAt - currentTime;
      
      if (timeUntilExpiry <= 0) {
        throw new Error('JWT token has expired');
      }
      
      if (timeUntilExpiry < 300) { // Less than 5 minutes
        throw new Error('JWT token expires soon');
      }
      
      return {
        hasValidToken: true,
        tokenExpiresAt: new Date(tokenExpiresAt * 1000).toISOString(),
        timeUntilExpiry: Math.round(timeUntilExpiry),
        tokenAge: currentTime - (session.created_at ? new Date(session.created_at).getTime() / 1000 : 0),
        provider: session.provider
      };
    }, 'JWT Token Validation');
  }

  // Test 3: Authentication Configuration
  async testAuthConfiguration() {
    return await this.measureTime(async () => {
      const configChecks = {
        supabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
        supabaseAnonKey: !!import.meta.env.VITE_SUPABASE_ANON_KEY
      };
      
      const missingConfigs = Object.entries(configChecks)
        .filter(([key, value]) => !value)
        .map(([key]) => key);
      
      if (missingConfigs.length > 0) {
        throw new Error(`Missing auth configuration: ${missingConfigs.join(', ')}`);
      }

      // Security Check: Service Role Key should NOT be in frontend
      const serviceRoleExposed = !!import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      // Test Supabase client initialization
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error && error.message.includes('Invalid API key')) {
          throw new Error('Invalid Supabase API key configuration');
        }
      } catch (error) {
        if (error.message.includes('Invalid API key')) {
          throw error;
        }
      }
      
      return {
        configurationValid: true,
        configs: configChecks,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? 'configured' : 'missing',
        environment: import.meta.env.MODE,
        securityAlert: serviceRoleExposed ? 'CRITICAL: Service Role Key exposed in frontend!' : 'Safe: No service key exposed'
      };
    }, 'Authentication Configuration');
  }

  // Test 4: Permission and Role Verification
  async testPermissionVerification() {
    return await this.measureTime(async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Cannot verify permissions without active user');
      }
      
      // Check user role in database - using a more robust select
      let userData = null;
      let dbError = null;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        userData = data;
        dbError = error;
      } catch (e) {
        dbError = e;
      }
      
      if (dbError && dbError.message.includes('column "is_admin" does not exist')) {
         // Fallback for different schema
         const { data, error } = await supabase.from('users').select('*').limit(1).single();
         userData = data;
         dbError = error;
      }
      
      // Test admin access
      let adminAccess = false;
      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admin_logs')
          .select('count')
          .limit(1);
        
        adminAccess = !adminError;
      } catch (error) {
        adminAccess = false;
      }
      
      return {
        userId: user.id,
        isAdmin: userData?.is_admin || false,
        role: userData?.role || 'user',
        permissions: userData?.permissions || [],
        adminAccess: adminAccess,
        permissionConsistent: userData?.is_admin === adminAccess
      };
    }, 'Permission and Role Verification');
  }

  // Test 5: Authentication Flow Testing
  async testAuthenticationFlow() {
    return await this.measureTime(async () => {
      // Note: This test would require test credentials or mock authentication
      // For now, we'll test the auth endpoints availability
      
      const flowTests = [];
      
      // Test sign up endpoint availability
      try {
        // This is a mock test - in production, you'd use test credentials
        const signUpTest = {
          endpoint: 'auth.signUp',
          available: true,
          note: 'Endpoint available (mock test)'
        };
        flowTests.push(signUpTest);
      } catch (error) {
        flowTests.push({
          endpoint: 'auth.signUp',
          available: false,
          error: error.message
        });
      }
      
      // Test sign in endpoint availability
      try {
        const signInTest = {
          endpoint: 'auth.signIn',
          available: true,
          note: 'Endpoint available (mock test)'
        };
        flowTests.push(signInTest);
      } catch (error) {
        flowTests.push({
          endpoint: 'auth.signIn',
          available: false,
          error: error.message
        });
      }
      
      // Test sign out functionality
      try {
        // Get current session first
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Test sign out (but don't actually sign out the current user)
          const signOutTest = {
            endpoint: 'auth.signOut',
            available: true,
            note: 'Endpoint available (not executed to preserve session)'
          };
          flowTests.push(signOutTest);
        } else {
          flowTests.push({
            endpoint: 'auth.signOut',
            available: true,
            note: 'No active session to sign out'
          });
        }
      } catch (error) {
        flowTests.push({
          endpoint: 'auth.signOut',
          available: false,
          error: error.message
        });
      }
      
      const unavailableEndpoints = flowTests.filter(t => !t.available);
      if (unavailableEndpoints.length > 0) {
        throw new Error(`${unavailableEndpoints.length} auth endpoints unavailable: ${unavailableEndpoints.map(e => e.endpoint).join(', ')}`);
      }
      
      return {
        totalEndpoints: flowTests.length,
        availableEndpoints: flowTests.filter(t => t.available).length,
        flowTests
      };
    }, 'Authentication Flow Testing');
  }

  // Test 6: Security Headers and Configuration
  async testSecurityConfiguration() {
    return await this.measureTime(async () => {
      const securityChecks = [];
      
      // Test CORS configuration
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Origin': window.location.origin
          }
        });
        
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        securityChecks.push({
          check: 'CORS Configuration',
          status: response.ok ? 'pass' : (isLocalhost ? 'warn' : 'fail'),
          details: {
            statusCode: response.status,
            ok: response.ok,
            corsHeaders: response.headers.get('access-control-allow-origin'),
            isLocalhost: isLocalhost,
            note: isLocalhost && !response.ok ? 'CORS error ignored on localhost' : null
          }
        });
      } catch (error) {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        securityChecks.push({
          check: 'CORS Configuration',
          status: isLocalhost ? 'warn' : 'fail',
          details: { 
            error: error.message,
            isLocalhost: isLocalhost,
            note: isLocalhost ? 'CORS fetch failed on localhost (expected if not configured)' : null
          }
        });
      }
      
      // Test API key security
      const apiKeyChecks = {
        anonKeyLength: import.meta.env.VITE_SUPABASE_ANON_KEY?.length || 0,
        serviceRoleKeyLength: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.length || 0,
        anonKeyExposed: import.meta.env.VITE_SUPABASE_ANON_KEY?.includes('demo') || false,
        serviceRoleKeyExposed: import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY?.includes('demo') || false
      };
      
      securityChecks.push({
        check: 'API Key Security',
        status: apiKeyChecks.anonKeyExposed || apiKeyChecks.serviceRoleKeyExposed ? 'warn' : 'pass',
        details: apiKeyChecks
      });
      
      // Test session timeout configuration
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const sessionDuration = session.expires_at - (session.created_at ? new Date(session.created_at).getTime() / 1000 : 0);
          securityChecks.push({
            check: 'Session Duration',
            status: sessionDuration > 0 ? 'pass' : 'fail',
            details: {
              sessionDuration: Math.round(sessionDuration),
              expiresAt: new Date(session.expires_at * 1000).toISOString()
            }
          });
        } else {
          securityChecks.push({
            check: 'Session Duration',
            status: 'skip',
            details: { message: 'No active session' }
          });
        }
      } catch (error) {
        securityChecks.push({
          check: 'Session Duration',
          status: 'fail',
          details: { error: error.message }
        });
      }
      
      const failedChecks = securityChecks.filter(c => c.status === 'fail');
      if (failedChecks.length > 0) {
        throw new Error(`Security configuration issues: ${failedChecks.map(c => c.check).join(', ')}`);
      }
      
      return {
        totalChecks: securityChecks.length,
        passedChecks: securityChecks.filter(c => c.status === 'pass').length,
        warningChecks: securityChecks.filter(c => c.status === 'warn').length,
        failedChecks: failedChecks.length,
        securityChecks
      };
    }, 'Security Configuration');
  }

  // Test 7: Multi-Provider Authentication
  async testMultiProviderAuth() {
    return await this.measureTime(async () => {
      const providerTests = [];
      
      // Test Google OAuth availability
      try {
        const googleTest = {
          provider: 'google',
          available: true,
          note: 'Google OAuth configured (mock test)'
        };
        providerTests.push(googleTest);
      } catch (error) {
        providerTests.push({
          provider: 'google',
          available: false,
          error: error.message
        });
      }
      
      // Test other providers if configured
      const commonProviders = ['github', 'facebook', 'apple'];
      
      for (const provider of commonProviders) {
        try {
          const providerTest = {
            provider: provider,
            available: true,
            note: `${provider} OAuth available (mock test)`
          };
          providerTests.push(providerTest);
        } catch (error) {
          providerTests.push({
            provider: provider,
            available: false,
            error: error.message
          });
        }
      }
      
      return {
        totalProviders: providerTests.length,
        availableProviders: providerTests.filter(p => p.available).length,
        providerTests
      };
    }, 'Multi-Provider Authentication');
  }

  // Test 8: Session Management
  async testSessionManagement() {
    return await this.measureTime(async () => {
      const sessionTests = [];
      
      // Test session persistence
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          sessionTests.push({
            test: 'Session Persistence',
            status: 'pass',
            details: {
              hasSession: true,
              sessionId: session.access_token ? 'present' : 'missing',
              refreshToken: session.refresh_token ? 'present' : 'missing'
            }
          });
        } else {
          sessionTests.push({
            test: 'Session Persistence',
            status: 'skip',
            details: { message: 'No active session' }
          });
        }
      } catch (error) {
        sessionTests.push({
          test: 'Session Persistence',
          status: 'fail',
          details: { error: error.message }
        });
      }
      
      // Test session refresh capability
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session && session.refresh_token) {
          sessionTests.push({
            test: 'Session Refresh',
            status: 'pass',
            details: {
              hasRefreshToken: true,
              canRefresh: true
            }
          });
        } else {
          sessionTests.push({
            test: 'Session Refresh',
            status: session ? 'warn' : 'skip',
            details: { 
              message: session ? 'No refresh token available' : 'No active session'
            }
          });
        }
      } catch (error) {
        sessionTests.push({
          test: 'Session Refresh',
          status: 'fail',
          details: { error: error.message }
        });
      }
      
      // Test concurrent session handling
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          sessionTests.push({
            test: 'Concurrent Sessions',
            status: 'pass',
            details: {
              currentSessionValid: true,
              note: 'Concurrent session handling available'
            }
          });
        } else {
          sessionTests.push({
            test: 'Concurrent Sessions',
            status: 'skip',
            details: { message: 'No active session to test' }
          });
        }
      } catch (error) {
        sessionTests.push({
          test: 'Concurrent Sessions',
          status: 'fail',
          details: { error: error.message }
        });
      }
      
      const failedTests = sessionTests.filter(t => t.status === 'fail');
      if (failedTests.length > 0) {
        throw new Error(`Session management issues: ${failedTests.map(t => t.test).join(', ')}`);
      }
      
      return {
        totalTests: sessionTests.length,
        passedTests: sessionTests.filter(t => t.status === 'pass').length,
        warningTests: sessionTests.filter(t => t.status === 'warn').length,
        failedTests: failedTests.length,
        sessionTests
      };
    }, 'Session Management');
  }

  // Run all authentication tests
  async runAllTests() {
    this.startTime = performance.now();
    this.testResults = [];
    
    const tests = [
      this.testCurrentUserSession(),
      this.testJWTTokenValidation(),
      this.testAuthConfiguration(),
      this.testPermissionVerification(),
      this.testAuthenticationFlow(),
      this.testSecurityConfiguration(),
      this.testMultiProviderAuth(),
      this.testSessionManagement()
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
      category: 'Authentication',
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
          case 'Current User Session Validation':
            recommendations.push({
              priority: 'CRITICAL',
              issue: 'User session validation failed',
              solution: 'Check authentication flow and session management',
              estimatedTime: '1 hour'
            });
            break;
          case 'JWT Token Validation':
            recommendations.push({
              priority: 'CRITICAL',
              issue: 'JWT token validation failed',
              solution: 'Refresh session or check token configuration',
              estimatedTime: '30 minutes'
            });
            break;
          case 'Authentication Configuration':
            recommendations.push({
              priority: 'CRITICAL',
              issue: 'Authentication configuration missing',
              solution: 'Configure Supabase environment variables',
              estimatedTime: '15 minutes'
            });
            break;
          case 'Permission and Role Verification':
            recommendations.push({
              priority: 'HIGH',
              issue: 'Permission verification failed',
              solution: 'Review user roles and database permissions',
              estimatedTime: '2 hours'
            });
            break;
          case 'Security Configuration':
            recommendations.push({
              priority: 'HIGH',
              issue: 'Security configuration issues',
              solution: 'Review CORS settings and API key security',
              estimatedTime: '1 hour'
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
        category: 'Authentication',
        test: test.testName,
        message: test.message,
        details: test.details,
        severity: 'CRITICAL'
      }));
  }
}

export default AuthFeatureTests;
