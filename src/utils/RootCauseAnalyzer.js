/**
 * Advanced Root Cause Analysis (RCA) Engine
 * Intelligent automatic diagnosis of system issues
 */

import { supabase } from '../config/supabase';

class RootCauseAnalyzer {
  constructor() {
    this.dependencyMap = this.buildDependencyMap();
    this.fixStrategies = this.buildFixStrategies();
    this.impactAnalyzer = new ImpactAnalyzer();
  }

  // Build system dependency map
  buildDependencyMap() {
    return {
      'messaging': {
        depends_on: ['authentication', 'database', 'storage', 'realtime'],
        affects: ['user_experience', 'notifications', 'group_chat'],
        criticality: 'HIGH',
        components: ['message_crud', 'media_handling', 'realtime_updates', 'search']
      },
      'authentication': {
        depends_on: ['database', 'security'],
        affects: ['messaging', 'user_management', 'admin_access'],
        criticality: 'CRITICAL',
        components: ['user_sessions', 'jwt_tokens', 'permissions', 'rls_policies']
      },
      'database': {
        depends_on: ['supabase_service'],
        affects: ['all_features'],
        criticality: 'CRITICAL',
        components: ['connection_pool', 'queries', 'indexes', 'constraints']
      },
      'storage': {
        depends_on: ['database', 'supabase_service'],
        affects: ['messaging', 'user_profiles', 'media'],
        criticality: 'MEDIUM',
        components: ['file_upload', 'compression', 'cdn', 'quota']
      },
      'realtime': {
        depends_on: ['database', 'supabase_service'],
        affects: ['messaging', 'notifications', 'live_updates'],
        criticality: 'MEDIUM',
        components: ['subscriptions', 'websockets', 'events', 'channels']
      },
      'admin_panel': {
        depends_on: ['authentication', 'database'],
        affects: ['system_management'],
        criticality: 'HIGH',
        components: ['user_management', 'system_settings', 'audit_logs', 'reports']
      }
    };
  }

  // Build fix strategies database
  buildFixStrategies() {
    return {
      'connection_failed': {
        rootCause: 'Database connectivity issue',
        checks: [
          { test: 'supabase_status', action: 'check_supabase_health' },
          { test: 'network_connectivity', action: 'check_network' },
          { test: 'api_keys', action: 'validate_credentials' },
          { test: 'service_status', action: 'check_supabase_outage' }
        ],
        solutions: [
          {
            condition: 'supabase_down',
            action: 'wait_for_supabase_recovery',
            autoFixable: false,
            estimatedTime: 'Variable'
          },
          {
            condition: 'wrong_credentials',
            action: 'update_api_keys',
            autoFixable: false,
            estimatedTime: '5 minutes'
          },
          {
            condition: 'network_issue',
            action: 'check_internet_connection',
            autoFixable: true,
            estimatedTime: '2 minutes'
          }
        ]
      },
      'message_send_failed': {
        rootCause: 'Message sending blocked',
        checks: [
          { test: 'user_auth', action: 'check_user_session' },
          { test: 'rls_policies', action: 'check_message_rls' },
          { test: 'database_write', action: 'test_insert_permission' },
          { test: 'storage_access', action: 'check_media_storage' }
        ],
        solutions: [
          {
            condition: 'session_expired',
            action: 'refresh_user_session',
            autoFixable: true,
            estimatedTime: '30 seconds'
          },
          {
            condition: 'rls_blocking',
            action: 'update_rls_policy',
            autoFixable: false,
            estimatedTime: '30 minutes',
            codeFix: `ALTER POLICY "Users can insert messages" ON messages 
                     USING (auth.uid() = sender_id OR auth.uid() = receiver_id);`
          },
          {
            condition: 'storage_full',
            action: 'cleanup_old_media',
            autoFixable: true,
            estimatedTime: '5 minutes'
          }
        ]
      },
      'realtime_subscription_failed': {
        rootCause: 'Realtime connection issue',
        checks: [
          { test: 'websocket_connection', action: 'check_websocket' },
          { test: 'channel_permissions', action: 'check_rls_realtime' },
          { test: 'service_config', action: 'check_realtime_config' }
        ],
        solutions: [
          {
            condition: 'websocket_blocked',
            action: 'restart_websocket',
            autoFixable: true,
            estimatedTime: '1 minute'
          },
          {
            condition: 'rls_realtime_issue',
            action: 'enable_realtime_rls',
            autoFixable: false,
            estimatedTime: '15 minutes'
          },
          {
            condition: 'service_disabled',
            action: 'enable_realtime_service',
            autoFixable: false,
            estimatedTime: '5 minutes'
          }
        ]
      },
      'slow_query_performance': {
        rootCause: 'Database performance degradation',
        checks: [
          { test: 'query_analysis', action: 'analyze_slow_queries' },
          { test: 'index_status', action: 'check_missing_indexes' },
          { test: 'connection_pool', action: 'check_pool_saturation' },
          { test: 'table_size', action: 'check_table_bloat' }
        ],
        solutions: [
          {
            condition: 'missing_indexes',
            action: 'add_performance_indexes',
            autoFixable: false,
            estimatedTime: '1 hour',
            codeFix: `CREATE INDEX CONCURRENTLY idx_messages_created_at 
                     ON messages(created_at DESC);`
          },
          {
            condition: 'pool_exhausted',
            action: 'increase_connection_pool',
            autoFixable: true,
            estimatedTime: '2 minutes'
          },
          {
            condition: 'table_bloat',
            action: 'vacuum_analyze_tables',
            autoFixable: true,
            estimatedTime: '10 minutes'
          }
        ]
      },
      'storage_upload_failed': {
        rootCause: 'File upload blocked',
        checks: [
          { test: 'bucket_permissions', action: 'check_bucket_rls' },
          { test: 'file_size_limits', action: 'check_size_restrictions' },
          { test: 'storage_quota', action: 'check_quota_usage' },
          { test: 'file_format', action: 'check_supported_formats' }
        ],
        solutions: [
          {
            condition: 'quota_exceeded',
            action: 'increase_storage_quota',
            autoFixable: false,
            estimatedTime: '5 minutes'
          },
          {
            condition: 'file_too_large',
            action: 'compress_before_upload',
            autoFixable: true,
            estimatedTime: '30 seconds'
          },
          {
            condition: 'unsupported_format',
            action: 'convert_to_supported_format',
            autoFixable: true,
            estimatedTime: '1 minute'
          }
        ]
      }
    };
  }

  // Main analysis method
  async analyzeFailure(testResult, context = {}) {
    const analysis = {
      timestamp: new Date().toISOString(),
      testResult: testResult,
      rootCause: null,
      affectedFeatures: [],
      userImpact: null,
      suggestedFixes: [],
      estimatedFixTime: null,
      autoFixable: false,
      investigation: []
    };

    try {
      // Get failure pattern
      const failurePattern = this.identifyFailurePattern(testResult);
      analysis.rootCause = failurePattern.rootCause;

      // Run diagnostic chain
      const diagnosticResults = await this.runDiagnosticChain(failurePattern);
      analysis.investigation = diagnosticResults;

      // Find actual root cause
      const rootCauseFinding = diagnosticResults.find(r => r.failed);
      if (rootCauseFinding) {
        analysis.rootCause = rootCauseFinding.issue;
        analysis.suggestedFixes = this.getFixesForIssue(rootCauseFinding.issue);
      }

      // Analyze impact
      analysis.affectedFeatures = this.getAffectedFeatures(testResult.category);
      analysis.userImpact = await this.impactAnalyzer.calculateUserImpact(testResult, analysis);

      // Calculate fix time
      analysis.estimatedFixTime = this.calculateFixTime(analysis.suggestedFixes);
      analysis.autoFixable = analysis.suggestedFixes.some(fix => fix.autoFixable);

      return analysis;
    } catch (error) {
      console.error('RCA Analysis failed:', error);
      return {
        ...analysis,
        error: error.message,
        rootCause: 'Analysis failed',
        suggestedFixes: [{
          action: 'Manual investigation required',
          autoFixable: false,
          estimatedTime: 'Unknown'
        }]
      };
    }
  }

  // Identify failure pattern
  identifyFailurePattern(testResult) {
    const { testName, status, message, details } = testResult;
    
    // Pattern matching for common issues
    if (message.includes('connection') || message.includes('network')) {
      return { rootCause: 'connection_failed', pattern: 'network_issue' };
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return { rootCause: 'permission_denied', pattern: 'auth_issue' };
    }
    
    if (message.includes('timeout') || message.includes('slow')) {
      return { rootCause: 'performance_issue', pattern: 'slow_query' };
    }
    
    if (message.includes('RLS') || message.includes('row level security')) {
      return { rootCause: 'rls_policy_issue', pattern: 'security_policy' };
    }
    
    if (message.includes('storage') || message.includes('upload')) {
      return { rootCause: 'storage_issue', pattern: 'file_handling' };
    }
    
    if (message.includes('realtime') || message.includes('subscription')) {
      return { rootCause: 'realtime_issue', pattern: 'live_updates' };
    }

    // Default pattern
    return { 
      rootCause: 'unknown_issue', 
      pattern: 'general_failure',
      message: 'Unknown failure pattern detected'
    };
  }

  // Run diagnostic chain
  async runDiagnosticChain(failurePattern) {
    const strategy = this.fixStrategies[failurePattern.rootCause];
    if (!strategy) {
      return [{
        check: 'pattern_recognition',
        status: 'failed',
        issue: 'No diagnostic strategy found',
        action: 'Manual investigation required'
      }];
    }

    const results = [];
    
    for (const check of strategy.checks) {
      try {
        const result = await this.executeDiagnosticCheck(check);
        results.push(result);
        
        // Stop at first failure to find root cause
        if (result.failed) {
          break;
        }
      } catch (error) {
        results.push({
          check: check.test,
          status: 'error',
          issue: error.message,
          action: check.action
        });
        break;
      }
    }

    return results;
  }

  // Execute individual diagnostic check
  async executeDiagnosticCheck(check) {
    switch (check.action) {
      case 'check_supabase_health':
        return await this.checkSupabaseHealth();
      
      case 'check_network':
        return await this.checkNetworkConnectivity();
      
      case 'validate_credentials':
        return await this.validateCredentials();
      
      case 'check_user_session':
        return await this.checkUserSession();
      
      case 'check_message_rls':
        return await this.checkMessageRLS();
      
      case 'test_insert_permission':
        return await this.testInsertPermission();
      
      case 'check_websocket':
        return await this.checkWebSocketConnection();
      
      case 'analyze_slow_queries':
        return await this.analyzeSlowQueries();
      
      case 'check_missing_indexes':
        return await this.checkMissingIndexes();
      
      case 'check_bucket_rls':
        return await this.checkBucketRLS();
      
      default:
        return {
          check: check.test,
          status: 'skip',
          issue: 'Diagnostic check not implemented',
          action: check.action
        };
    }
  }

  // Diagnostic check implementations
  async checkSupabaseHealth() {
    try {
      const { data, error } = await supabase.from('users').select('count').single();
      
      return {
        check: 'supabase_health',
        status: error ? 'failed' : 'passed',
        issue: error ? `Supabase health check failed: ${error.message}` : null,
        details: { connected: !error, count: data?.count }
      };
    } catch (error) {
      return {
        check: 'supabase_health',
        status: 'failed',
        issue: `Supabase connection error: ${error.message}`,
        failed: true
      };
    }
  }

  async checkNetworkConnectivity() {
    try {
      const response = await fetch('https://api.supabase.io/health', {
        method: 'GET',
        timeout: 5000
      });
      
      return {
        check: 'network_connectivity',
        status: response.ok ? 'passed' : 'failed',
        issue: response.ok ? null : 'Network connectivity issue',
        details: { status: response.status, ok: response.ok }
      };
    } catch (error) {
      return {
        check: 'network_connectivity',
        status: 'failed',
        issue: `Network check failed: ${error.message}`,
        failed: true
      };
    }
  }

  async validateCredentials() {
    const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
    const hasAnonKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    return {
      check: 'credentials_validation',
      status: (hasUrl && hasAnonKey) ? 'passed' : 'failed',
      issue: (!hasUrl || !hasAnonKey) ? 'Missing Supabase credentials' : null,
      details: { 
        hasUrl, 
        hasAnonKey,
        urlConfigured: hasUrl ? 'Yes' : 'No',
        keyConfigured: hasAnonKey ? 'Yes' : 'No'
      },
      failed: !hasUrl || !hasAnonKey
    };
  }

  async checkUserSession() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      return {
        check: 'user_session',
        status: error || !user ? 'failed' : 'passed',
        issue: error ? `Session check failed: ${error.message}` : (!user ? 'No active user session' : null),
        details: { hasUser: !!user, userId: user?.id }
      };
    } catch (error) {
      return {
        check: 'user_session',
        status: 'failed',
        issue: `Session validation error: ${error.message}`,
        failed: true
      };
    }
  }

  async checkMessageRLS() {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .limit(1);
      
      const rlsBlocked = error && (error.code === '42501' || error.message.includes('permission denied'));
      
      return {
        check: 'message_rls',
        status: rlsBlocked ? 'failed' : 'passed',
        issue: rlsBlocked ? 'RLS policy blocking message access' : null,
        details: { rlsActive: rlsBlocked, error: error?.message }
      };
    } catch (error) {
      return {
        check: 'message_rls',
        status: 'failed',
        issue: `RLS check error: ${error.message}`,
        failed: true
      };
    }
  }

  async testInsertPermission() {
    // This would be a test insert that gets rolled back
    // For now, we'll check if we can read the table structure
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .limit(1);
      
      return {
        check: 'insert_permission',
        status: error ? 'failed' : 'passed',
        issue: error ? `Permission test failed: ${error.message}` : null,
        details: { canRead: !error, tableAccessible: !error }
      };
    } catch (error) {
      return {
        check: 'insert_permission',
        status: 'failed',
        issue: `Permission check error: ${error.message}`,
        failed: true
      };
    }
  }

  async checkWebSocketConnection() {
    try {
      const channel = supabase.channel('test-rca-channel');
      let connectionStatus = 'pending';
      
      const subscription = channel.subscribe((status) => {
        connectionStatus = status;
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      supabase.removeChannel(channel);
      
      return {
        check: 'websocket_connection',
        status: connectionStatus === 'SUBSCRIBED' ? 'passed' : 'failed',
        issue: connectionStatus !== 'SUBSCRIBED' ? `WebSocket connection: ${connectionStatus}` : null,
        details: { status: connectionStatus }
      };
    } catch (error) {
      return {
        check: 'websocket_connection',
        status: 'failed',
        issue: `WebSocket check error: ${error.message}`,
        failed: true
      };
    }
  }

  async analyzeSlowQueries() {
    // This would require access to query statistics
    // For now, return a mock result
    return {
      check: 'slow_queries',
      status: 'skip',
      issue: 'Query analysis not implemented',
      details: { message: 'Requires database admin access' }
    };
  }

  async checkMissingIndexes() {
    // This would require database introspection
    return {
      check: 'missing_indexes',
      status: 'skip',
      issue: 'Index analysis not implemented',
      details: { message: 'Requires database admin access' }
    };
  }

  async checkBucketRLS() {
    try {
      const { data, error } = await supabase.storage.listBuckets();
      
      return {
        check: 'bucket_rls',
        status: error ? 'failed' : 'passed',
        issue: error ? `Storage bucket check failed: ${error.message}` : null,
        details: { bucketCount: data?.length || 0, accessible: !error }
      };
    } catch (error) {
      return {
        check: 'bucket_rls',
        status: 'failed',
        issue: `Storage check error: ${error.message}`,
        failed: true
      };
    }
  }

  // Get affected features based on dependency map
  getAffectedFeatures(category) {
    const categoryKey = category.toLowerCase();
    const dependencies = this.dependencyMap[categoryKey];
    
    if (!dependencies) {
      return [category];
    }

    return [
      category,
      ...dependencies.affects,
      ...dependencies.depends_on
    ];
  }

  // Get fixes for specific issue
  getFixesForIssue(issue) {
    // Find matching strategy and return applicable solutions
    for (const [pattern, strategy] of Object.entries(this.fixStrategies)) {
      if (issue.includes(pattern) || pattern.includes(issue)) {
        return strategy.solutions;
      }
    }

    // Default fix
    return [{
      condition: 'unknown',
      action: 'Manual investigation required',
      autoFixable: false,
      estimatedTime: 'Unknown'
    }];
  }

  // Calculate total fix time
  calculateFixTime(fixes) {
    if (!fixes || fixes.length === 0) return 'Unknown';
    
    const times = fixes.map(fix => {
      const timeStr = fix.estimatedTime;
      const minutes = parseInt(timeStr) || 0;
      return minutes;
    }).filter(minutes => minutes > 0);

    if (times.length === 0) return 'Unknown';
    
    const maxTime = Math.max(...times);
    return `${maxTime} minutes`;
  }
}

// Impact Analyzer for user impact calculation
class ImpactAnalyzer {
  async calculateUserImpact(testResult, rcaAnalysis) {
    const impact = {
      affectedUsers: 0,
      businessImpact: 'LOW',
      revenueImpact: 'Minimal',
      urgency: 'Normal',
      userExperience: 'Slightly Affected'
    };

    try {
      // Get current active users
      const { data: activeUsers } = await supabase
        .from('users')
        .select('id')
        .eq('is_online', true);

      impact.affectedUsers = activeUsers?.length || 0;

      // Calculate business impact based on feature criticality
      const criticalFeatures = ['authentication', 'messaging', 'database'];
      const isCritical = criticalFeatures.includes(testResult.category?.toLowerCase());

      if (isCritical) {
        impact.businessImpact = 'HIGH';
        impact.revenueImpact = 'Significant';
        impact.urgency = 'Critical';
        impact.userExperience = 'Severely Affected';
      } else if (rcaAnalysis.affectedFeatures.length > 3) {
        impact.businessImpact = 'MEDIUM';
        impact.revenueImpact = 'Moderate';
        impact.urgency = 'High';
        impact.userExperience = 'Moderately Affected';
      }

      return impact;
    } catch (error) {
      console.error('Impact analysis failed:', error);
      return impact;
    }
  }
}

export default RootCauseAnalyzer;
