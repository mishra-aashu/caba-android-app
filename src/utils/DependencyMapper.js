/**
 * Dependency Mapper & Impact Analysis System
 * Visualizes system dependencies and analyzes impact of failures
 */

class DependencyMapper {
  constructor() {
    this.dependencyGraph = this.buildDependencyGraph();
    this.impactMatrix = this.buildImpactMatrix();
    this.criticalPaths = this.identifyCriticalPaths();
  }

  // Build comprehensive dependency graph
  buildDependencyGraph() {
    return {
      // Core Infrastructure
      infrastructure: {
        name: 'Infrastructure',
        type: 'infrastructure',
        status: 'active',
        components: {
          supabase_service: {
            name: 'Supabase Service',
            type: 'service',
            status: 'active',
            dependencies: [],
            provides: ['database', 'auth', 'storage', 'realtime'],
            criticality: 'CRITICAL',
            health: 95,
            metrics: {
              uptime: '99.9%',
              response_time: '120ms',
              availability: '99.95%'
            }
          },
          network_layer: {
            name: 'Network Layer',
            type: 'infrastructure',
            status: 'active',
            dependencies: [],
            provides: ['connectivity', 'dns', 'routing'],
            criticality: 'CRITICAL',
            health: 98,
            metrics: {
              latency: '45ms',
              packet_loss: '0.1%',
              bandwidth: '1Gbps'
            }
          }
        }
      },

      // Authentication System
      authentication: {
        name: 'Authentication System',
        type: 'system',
        status: 'active',
        components: {
          user_sessions: {
            name: 'User Sessions',
            type: 'component',
            status: 'active',
            dependencies: ['database', 'supabase_service'],
            provides: ['session_management', 'token_validation'],
            criticality: 'CRITICAL',
            health: 92,
            metrics: {
              active_sessions: 1247,
              session_duration: '2.3 hours',
              refresh_rate: '95%'
            }
          },
          jwt_service: {
            name: 'JWT Token Service',
            type: 'component',
            status: 'active',
            dependencies: ['database'],
            provides: ['token_generation', 'token_validation'],
            criticality: 'HIGH',
            health: 98,
            metrics: {
              tokens_issued_per_hour: 3420,
              validation_time: '15ms',
              success_rate: '99.8%'
            }
          },
          permission_system: {
            name: 'Permission System',
            type: 'component',
            status: 'active',
            dependencies: ['database', 'user_sessions'],
            provides: ['access_control', 'role_management'],
            criticality: 'HIGH',
            health: 95,
            metrics: {
              permission_checks_per_minute: 12400,
              cache_hit_rate: '87%',
              average_check_time: '3ms'
            }
          }
        }
      },

      // Database System
      database: {
        name: 'Database System',
        type: 'system',
        status: 'active',
        components: {
          connection_pool: {
            name: 'Connection Pool',
            type: 'component',
            status: 'active',
            dependencies: ['supabase_service'],
            provides: ['database_connections', 'query_execution'],
            criticality: 'CRITICAL',
            health: 88,
            metrics: {
              active_connections: 15,
              max_connections: 20,
              pool_utilization: '75%',
              average_query_time: '280ms'
            }
          },
          query_optimizer: {
            name: 'Query Optimizer',
            type: 'component',
            status: 'active',
            dependencies: ['connection_pool'],
            provides: ['query_planning', 'index_usage'],
            criticality: 'HIGH',
            health: 91,
            metrics: {
              queries_per_second: 145,
              index_hit_rate: '94%',
              optimization_time: '12ms'
            }
          },
          data_integrity: {
            name: 'Data Integrity',
            type: 'component',
            status: 'active',
            dependencies: ['connection_pool'],
            provides: ['consistency', 'constraints', 'validation'],
            criticality: 'CRITICAL',
            health: 99,
            metrics: {
              constraint_violations: 0,
              data_consistency_score: '99.9%',
              backup_success_rate: '100%'
            }
          }
        }
      },

      // Messaging System
      messaging: {
        name: 'Messaging System',
        type: 'system',
        status: 'active',
        components: {
          message_crud: {
            name: 'Message CRUD',
            type: 'component',
            status: 'active',
            dependencies: ['database', 'authentication'],
            provides: ['message_creation', 'message_retrieval', 'message_deletion'],
            criticality: 'HIGH',
            health: 93,
            metrics: {
              messages_per_hour: 8450,
              create_time: '45ms',
              read_time: '120ms'
            }
          },
          media_handler: {
            name: 'Media Handler',
            type: 'component',
            status: 'active',
            dependencies: ['storage', 'database'],
            provides: ['file_upload', 'file_compression', 'file_validation'],
            criticality: 'MEDIUM',
            health: 89,
            metrics: {
              files_processed_per_hour: 234,
              average_file_size: '2.3MB',
              compression_ratio: '35%'
            }
          },
          realtime_engine: {
            name: 'Realtime Engine',
            type: 'component',
            status: 'active',
            dependencies: ['database', 'websocket_manager'],
            provides: ['live_updates', 'push_notifications', 'event_broadcasting'],
            criticality: 'HIGH',
            health: 85,
            metrics: {
              active_subscriptions: 3420,
              events_per_second: 78,
              latency: '95ms'
            }
          },
          search_system: {
            name: 'Search System',
            type: 'component',
            status: 'active',
            dependencies: ['database'],
            provides: ['full_text_search', 'filtering', 'sorting'],
            criticality: 'MEDIUM',
            health: 91,
            metrics: {
              searches_per_minute: 145,
              average_search_time: '230ms',
              result_relevance: '87%'
            }
          }
        }
      },

      // Storage System
      storage: {
        name: 'Storage System',
        type: 'system',
        status: 'active',
        components: {
          file_storage: {
            name: 'File Storage',
            type: 'component',
            status: 'active',
            dependencies: ['supabase_service'],
            provides: ['file_upload', 'file_download', 'file_management'],
            criticality: 'MEDIUM',
            health: 92,
            metrics: {
              storage_used: '750MB',
              storage_quota: '1GB',
              utilization: '75%',
              files_total: 12450
            }
          },
          cdn_manager: {
            name: 'CDN Manager',
            type: 'component',
            status: 'active',
            dependencies: ['file_storage'],
            provides: ['content_delivery', 'caching', 'optimization'],
            criticality: 'LOW',
            health: 94,
            metrics: {
              cache_hit_rate: '92%',
              delivery_time: '45ms',
              bandwidth_saved: '67%'
            }
          }
        }
      },

      // Realtime System
      realtime: {
        name: 'Realtime System',
        type: 'system',
        status: 'active',
        components: {
          websocket_manager: {
            name: 'WebSocket Manager',
            type: 'component',
            status: 'active',
            dependencies: ['network_layer'],
            provides: ['websocket_connections', 'connection_management'],
            criticality: 'MEDIUM',
            health: 87,
            metrics: {
              active_connections: 3420,
              connection_success_rate: '98.5%',
              average_connection_time: '200ms'
            }
          },
          event_dispatcher: {
            name: 'Event Dispatcher',
            type: 'component',
            status: 'active',
            dependencies: ['websocket_manager', 'database'],
            provides: ['event_routing', 'message_broadcasting'],
            criticality: 'MEDIUM',
            health: 90,
            metrics: {
              events_per_second: 124,
              dispatch_latency: '35ms',
              delivery_success_rate: '97.2%'
            }
          }
        }
      },

      // Admin System
      admin_panel: {
        name: 'Admin Panel',
        type: 'system',
        status: 'active',
        components: {
          user_management: {
            name: 'User Management',
            type: 'component',
            status: 'active',
            dependencies: ['database', 'authentication'],
            provides: ['user_crud', 'user_permissions', 'user_analytics'],
            criticality: 'HIGH',
            health: 95,
            metrics: {
              total_users: 5420,
              active_users: 1247,
              admin_actions_per_day: 145
            }
          },
          system_monitoring: {
            name: 'System Monitoring',
            type: 'component',
            status: 'active',
            dependencies: ['database', 'authentication'],
            provides: ['health_checks', 'performance_metrics', 'alerting'],
            criticality: 'HIGH',
            health: 98,
            metrics: {
              checks_per_minute: 45,
              alert_response_time: '2.3 minutes',
              system_health_score: '91%'
            }
          }
        }
      }
    };
  }

  // Build impact matrix
  buildImpactMatrix() {
    return {
      // Impact scores (0-100)
      user_experience: {
        authentication: 100,
        messaging: 90,
        database: 100,
        storage: 60,
        realtime: 70,
        admin_panel: 40
      },
      business_operations: {
        authentication: 100,
        messaging: 85,
        database: 100,
        storage: 75,
        realtime: 60,
        admin_panel: 95
      },
      revenue_impact: {
        authentication: 100,
        messaging: 70,
        database: 100,
        storage: 50,
        realtime: 40,
        admin_panel: 80
      },
      technical_debt: {
        authentication: 30,
        messaging: 60,
        database: 70,
        storage: 40,
        realtime: 50,
        admin_panel: 20
      }
    };
  }

  // Identify critical paths
  identifyCriticalPaths() {
    return [
      {
        name: 'User Authentication Flow',
        path: ['network_layer', 'supabase_service', 'user_sessions', 'jwt_service'],
        criticality: 'CRITICAL',
        impact_score: 100,
        single_point_of_failure: ['supabase_service', 'user_sessions']
      },
      {
        name: 'Message Delivery Flow',
        path: ['network_layer', 'supabase_service', 'message_crud', 'realtime_engine', 'websocket_manager'],
        criticality: 'HIGH',
        impact_score: 85,
        single_point_of_failure: ['message_crud', 'realtime_engine']
      },
      {
        name: 'Data Persistence Flow',
        path: ['network_layer', 'supabase_service', 'connection_pool', 'data_integrity'],
        criticality: 'CRITICAL',
        impact_score: 100,
        single_point_of_failure: ['connection_pool', 'data_integrity']
      },
      {
        name: 'Media Upload Flow',
        path: ['network_layer', 'supabase_service', 'file_storage', 'media_handler'],
        criticality: 'MEDIUM',
        impact_score: 60,
        single_point_of_failure: ['file_storage']
      }
    ];
  }

  // Analyze impact of component failure
  analyzeImpact(failedComponent, failureType = 'complete') {
    const impact = {
      failedComponent,
      failureType,
      timestamp: new Date().toISOString(),
      directImpact: [],
      downstreamImpact: [],
      upstreamImpact: [],
      affectedSystems: [],
      userImpact: {
        affectedUsers: 0,
        impactSeverity: 'LOW',
        functionalityLoss: [],
        experienceDegradation: 'MINIMAL'
      },
      businessImpact: {
        revenueLoss: 'MINIMAL',
        operationalDisruption: 'LOW',
        complianceRisk: 'LOW',
        reputationImpact: 'MINIMAL'
      },
      criticalPathsAffected: [],
      recommendedActions: [],
      estimatedRecoveryTime: 'Unknown'
    };

    // Find component in dependency graph
    const component = this.findComponent(failedComponent);
    if (!component) {
      impact.error = 'Component not found in dependency graph';
      return impact;
    }

    // Analyze direct dependencies
    impact.directImpact = this.getDirectDependencies(component);
    
    // Analyze downstream impact
    impact.downstreamImpact = this.getDownstreamImpact(component);
    
    // Analyze upstream impact
    impact.upstreamImpact = this.getUpstreamImpact(component);
    
    // Get affected systems
    impact.affectedSystems = this.getAffectedSystems(component);
    
    // Calculate user impact
    impact.userImpact = this.calculateUserImpact(component, failureType);
    
    // Calculate business impact
    impact.businessImpact = this.calculateBusinessImpact(component, failureType);
    
    // Check critical paths
    impact.criticalPathsAffected = this.getCriticalPathsAffected(component);
    
    // Generate recommendations
    impact.recommendedActions = this.generateRecoveryActions(component, failureType);
    
    // Estimate recovery time
    impact.estimatedRecoveryTime = this.estimateRecoveryTime(component, failureType);

    return impact;
  }

  // Find component in dependency graph
  findComponent(componentName) {
    for (const system of Object.values(this.dependencyGraph)) {
      if (system.components && system.components[componentName]) {
        return {
          ...system.components[componentName],
          systemName: system.name,
          systemType: system.type
        };
      }
    }
    return null;
  }

  // Get direct dependencies
  getDirectDependencies(component) {
    return component.dependencies.map(dep => {
      const depComponent = this.findComponent(dep);
      return {
        name: dep,
        status: depComponent?.status || 'unknown',
        criticality: depComponent?.criticality || 'UNKNOWN',
        impact: depComponent ? 'DEPENDENCY_UNAVAILABLE' : 'COMPONENT_NOT_FOUND'
      };
    });
  }

  // Get downstream impact (components that depend on this)
  getDownstreamImpact(component) {
    const downstream = [];
    
    for (const system of Object.values(this.dependencyGraph)) {
      for (const [compName, comp] of Object.entries(system.components || {})) {
        if (comp.dependencies.includes(component.name || compName)) {
          downstream.push({
            name: compName,
            system: system.name,
            criticality: comp.criticality,
            impact: 'SERVICE_DEGRADED',
            functionality: comp.provides || []
          });
        }
      }
    }
    
    return downstream;
  }

  // Get upstream impact (components this depends on)
  getUpstreamImpact(component) {
    return component.dependencies.map(dep => {
      const depComponent = this.findComponent(dep);
      return {
        name: dep,
        status: depComponent?.status || 'unknown',
        criticality: depComponent?.criticality || 'UNKNOWN',
        impact: 'DEPENDENCY_REQUIRED',
        provides: depComponent?.provides || []
      };
    });
  }

  // Get all affected systems
  getAffectedSystems(component) {
    const affected = new Set();
    
    // Add current system
    if (component.systemName) {
      affected.add(component.systemName);
    }
    
    // Add systems of downstream components
    const downstream = this.getDownstreamImpact(component);
    downstream.forEach(comp => {
      if (comp.system) {
        affected.add(comp.system);
      }
    });
    
    return Array.from(affected).map(system => ({
      name: system,
      impact: this.calculateSystemImpact(system, component),
      status: 'DEGRADED'
    }));
  }

  // Calculate user impact
  calculateUserImpact(component, failureType) {
    const impact = {
      affectedUsers: 0,
      impactSeverity: 'LOW',
      functionalityLoss: [],
      experienceDegradation: 'MINIMAL'
    };

    // Base impact on component criticality
    if (component.criticality === 'CRITICAL') {
      impact.impactSeverity = 'CRITICAL';
      impact.experienceDegradation = 'SEVERE';
      impact.affectedUsers = 5420; // All users
    } else if (component.criticality === 'HIGH') {
      impact.impactSeverity = 'HIGH';
      impact.experienceDegradation = 'SIGNIFICANT';
      impact.affectedUsers = Math.floor(5420 * 0.7); // 70% of users
    } else if (component.criticality === 'MEDIUM') {
      impact.impactSeverity = 'MEDIUM';
      impact.experienceDegradation = 'MODERATE';
      impact.affectedUsers = Math.floor(5420 * 0.3); // 30% of users
    }

    // Add specific functionality loss
    if (component.provides) {
      impact.functionalityLoss = component.provides.map(func => ({
        functionality: func,
        impact: this.getFunctionalityImpact(func),
        workaround: this.getWorkaround(func)
      }));
    }

    return impact;
  }

  // Calculate business impact
  calculateBusinessImpact(component, failureType) {
    const impact = {
      revenueLoss: 'MINIMAL',
      operationalDisruption: 'LOW',
      complianceRisk: 'LOW',
      reputationImpact: 'MINIMAL'
    };

    // Use impact matrix to calculate business impact
    const systemName = component.systemName?.toLowerCase() || 'unknown';
    
    if (this.impactMatrix.user_experience[systemName] >= 90) {
      impact.revenueLoss = 'HIGH';
      impact.operationalDisruption = 'HIGH';
      impact.reputationImpact = 'SIGNIFICANT';
    } else if (this.impactMatrix.user_experience[systemName] >= 70) {
      impact.revenueLoss = 'MEDIUM';
      impact.operationalDisruption = 'MEDIUM';
      impact.reputationImpact = 'MODERATE';
    }

    if (this.impactMatrix.business_operations[systemName] >= 90) {
      impact.operationalDisruption = 'CRITICAL';
      impact.complianceRisk = 'HIGH';
    }

    return impact;
  }

  // Get critical paths affected
  getCriticalPathsAffected(component) {
    return this.criticalPaths
      .filter(path => path.path.includes(component.name))
      .map(path => ({
        ...path,
        status: 'BROKEN',
        impact: path.criticality === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        estimatedUsersAffected: path.impact_score >= 90 ? 5420 : Math.floor(5420 * (path.impact_score / 100))
      }));
  }

  // Generate recovery actions
  generateRecoveryActions(component, failureType) {
    const actions = [];

    // Immediate actions
    actions.push({
      priority: 'IMMEDIATE',
      action: 'Isolate failed component',
      description: 'Prevent cascade failures by isolating the component',
      estimatedTime: '5 minutes',
      risk: 'LOW'
    });

    // Recovery actions based on component type
    if (component.type === 'service') {
      actions.push({
        priority: 'HIGH',
        action: 'Restart service',
        description: 'Attempt service restart to restore functionality',
        estimatedTime: '2 minutes',
        risk: 'MEDIUM'
      });
    }

    if (component.dependencies && component.dependencies.length > 0) {
      actions.push({
        priority: 'HIGH',
        action: 'Check dependencies',
        description: 'Verify all dependencies are healthy',
        estimatedTime: '10 minutes',
        risk: 'LOW'
      });
    }

    // Fallback actions
    actions.push({
      priority: 'MEDIUM',
      action: 'Enable fallback mode',
      description: 'Activate backup or degraded functionality',
      estimatedTime: '15 minutes',
      risk: 'MEDIUM'
    });

    // Long-term actions
    actions.push({
      priority: 'LOW',
      action: 'Review and improve redundancy',
      description: 'Add redundancy to prevent future failures',
      estimatedTime: '4 hours',
      risk: 'LOW'
    });

    return actions;
  }

  // Estimate recovery time
  estimateRecoveryTime(component, failureType) {
    const baseTimes = {
      'service': '5 minutes',
      'component': '10 minutes',
      'infrastructure': '30 minutes',
      'system': '1 hour'
    };

    const baseTime = baseTimes[component.type] || '30 minutes';
    
    // Adjust based on criticality
    if (component.criticality === 'CRITICAL') {
      return `${Math.floor(parseInt(baseTime) * 0.5)} minutes`; // Faster recovery for critical
    } else if (component.criticality === 'LOW') {
      return `${Math.floor(parseInt(baseTime) * 2)} minutes`; // Slower for non-critical
    }

    return baseTime;
  }

  // Helper methods
  calculateSystemImpact(system, component) {
    const score = this.impactMatrix.user_experience[system.toLowerCase()] || 0;
    return score >= 90 ? 'CRITICAL' : score >= 70 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
  }

  getFunctionalityImpact(functionality) {
    const impacts = {
      'session_management': 'CRITICAL',
      'token_validation': 'CRITICAL',
      'message_creation': 'HIGH',
      'message_retrieval': 'HIGH',
      'file_upload': 'MEDIUM',
      'live_updates': 'MEDIUM',
      'user_crud': 'HIGH',
      'health_checks': 'LOW'
    };
    
    return impacts[functionality] || 'MEDIUM';
  }

  getWorkaround(functionality) {
    const workarounds = {
      'session_management': 'No workaround - requires immediate fix',
      'token_validation': 'No workaround - requires immediate fix',
      'message_creation': 'Use offline mode, sync when restored',
      'message_retrieval': 'Use cached messages',
      'file_upload': 'Disable file uploads temporarily',
      'live_updates': 'Switch to polling mode',
      'user_crud': 'Read-only mode available',
      'health_checks': 'Manual monitoring available'
    };
    
    return workarounds[functionality] || 'No workaround available';
  }

  // Get system health overview
  getSystemHealth() {
    const health = {
      overall: 'HEALTHY',
      systems: {},
      criticalIssues: [],
      warnings: []
    };

    let totalHealth = 0;
    let componentCount = 0;

    for (const [systemName, system] of Object.entries(this.dependencyGraph)) {
      let systemHealth = 0;
      let systemComponents = 0;
      const systemIssues = [];

      for (const [compName, component] of Object.entries(system.components || {})) {
        systemHealth += component.health;
        systemComponents++;
        componentCount++;

        if (component.health < 70) {
          health.criticalIssues.push({
            system: systemName,
            component: compName,
            health: component.health,
            criticality: component.criticality
          });
        } else if (component.health < 85) {
          health.warnings.push({
            system: systemName,
            component: compName,
            health: component.health,
            criticality: component.criticality
          });
        }
      }

      health.systems[systemName] = {
        health: Math.round(systemHealth / systemComponents),
        status: systemHealth / systemComponents >= 90 ? 'HEALTHY' : 
                systemHealth / systemComponents >= 70 ? 'WARNING' : 'CRITICAL',
        components: systemComponents
      };

      totalHealth += systemHealth;
    }

    const overallHealth = Math.round(totalHealth / componentCount);
    health.overall = overallHealth >= 90 ? 'HEALTHY' : 
                    overallHealth >= 70 ? 'WARNING' : 'CRITICAL';
    health.overallHealth = overallHealth;

    return health;
  }

  // Get dependency visualization data
  getVisualizationData() {
    const nodes = [];
    const edges = [];

    // Create nodes
    for (const [systemName, system] of Object.entries(this.dependencyGraph)) {
      for (const [compName, component] of Object.entries(system.components || {})) {
        nodes.push({
          id: compName,
          label: component.name,
          group: systemName,
          health: component.health,
          criticality: component.criticality,
          type: component.type
        });
      }
    }

    // Create edges
    for (const node of nodes) {
      const component = this.findComponent(node.id);
      if (component && component.dependencies) {
        component.dependencies.forEach(dep => {
          edges.push({
            from: dep,
            to: node.id,
            type: 'dependency'
          });
        });
      }
    }

    return { nodes, edges };
  }
}

export default DependencyMapper;
