/**
 * Predictive Issue Detection System
 * Anticipates problems before they become critical
 */

import { supabase } from '../config/supabase';

class PredictiveAnalyzer {
  constructor() {
    this.metrics = {
      database_response_time: [],
      storage_usage: [],
      memory_consumption: [],
      api_error_rate: [],
      user_activity: [],
      message_volume: [],
      connection_pool_usage: [],
      cache_hit_rate: []
    };
    this.thresholds = this.buildThresholds();
    this.predictions = [];
    this.alerts = [];
  }

  // Build predictive thresholds
  buildThresholds() {
    return {
      database_response_time: {
        warning: 500, // ms
        critical: 1000, // ms
        trend_warning: 20, // % increase
        trend_critical: 50 // % increase
      },
      storage_usage: {
        warning: 80, // % of quota
        critical: 95, // % of quota
        trend_warning: 10, // % increase per day
        trend_critical: 20 // % increase per day
      },
      memory_consumption: {
        warning: 70, // % of available
        critical: 90, // % of available
        trend_warning: 15, // % increase per hour
        trend_critical: 30 // % increase per hour
      },
      api_error_rate: {
        warning: 5, // % of requests
        critical: 15, // % of requests
        trend_warning: 2, // % increase per hour
        trend_critical: 5 // % increase per hour
      },
      user_activity: {
        warning: 50, // % decrease from normal
        critical: 80, // % decrease from normal
        trend_warning: 20, // % decrease per day
        trend_critical: 40 // % decrease per day
      },
      message_volume: {
        warning: 200, // % increase from baseline
        critical: 500, // % increase from baseline
        trend_warning: 50, // % increase per hour
        trend_critical: 100 // % increase per hour
      },
      connection_pool_usage: {
        warning: 80, // % of max connections
        critical: 95, // % of max connections
        trend_warning: 10, // % increase per hour
        trend_critical: 20 // % increase per hour
      },
      cache_hit_rate: {
        warning: 70, // % hit rate
        critical: 50, // % hit rate
        trend_warning: 10, // % decrease per hour
        trend_critical: 20 // % decrease per hour
      }
    };
  }

  // Collect current metrics
  async collectMetrics() {
    const timestamp = Date.now();
    const metrics = {};

    try {
      // Database response time
      const dbStart = performance.now();
      const { data: dbData, error: dbError } = await supabase.from('users').select('count').single();
      const dbEnd = performance.now();
      
      metrics.database_response_time = {
        timestamp,
        value: Math.round(dbEnd - dbStart),
        success: !dbError
      };

      // Storage usage (simulated - would need actual storage API)
      const storageUsage = await this.getStorageUsage();
      metrics.storage_usage = {
        timestamp,
        value: storageUsage.percentage,
        absolute: storageUsage.absolute,
        quota: storageUsage.quota
      };

      // Memory consumption (simulated - would need performance API)
      const memoryUsage = await this.getMemoryUsage();
      metrics.memory_consumption = {
        timestamp,
        value: memoryUsage.percentage,
        absolute: memoryUsage.absolute
      };

      // API error rate (from recent history)
      const errorRate = await this.getErrorRate();
      metrics.api_error_rate = {
        timestamp,
        value: errorRate
      };

      // User activity
      const userActivity = await this.getUserActivity();
      metrics.user_activity = {
        timestamp,
        value: userActivity.active,
        total: userActivity.total
      };

      // Message volume (last hour)
      const messageVolume = await this.getMessageVolume();
      metrics.message_volume = {
        timestamp,
        value: messageVolume.count,
        trend: messageVolume.trend
      };

      // Connection pool usage (simulated)
      const poolUsage = await this.getConnectionPoolUsage();
      metrics.connection_pool_usage = {
        timestamp,
        value: poolUsage.percentage,
        active: poolUsage.active,
        max: poolUsage.max
      };

      // Cache hit rate (simulated)
      const cacheHitRate = await this.getCacheHitRate();
      metrics.cache_hit_rate = {
        timestamp,
        value: cacheHitRate
      };

      // Store metrics
      Object.keys(metrics).forEach(key => {
        this.metrics[key].push(metrics[key]);
        // Keep only last 100 data points
        if (this.metrics[key].length > 100) {
          this.metrics[key].shift();
        }
      });

      return metrics;
    } catch (error) {
      console.error('Metrics collection failed:', error);
      return null;
    }
  }

  // Analyze trends and make predictions
  async analyzeTrends() {
    const predictions = [];
    const currentTime = Date.now();

    Object.keys(this.metrics).forEach(metricName => {
      const data = this.metrics[metricName];
      if (data.length < 10) return; // Need enough data for trend analysis

      const threshold = this.thresholds[metricName];
      if (!threshold) return;

      // Calculate trend
      const trend = this.calculateTrend(data);
      
      // Extrapolate future values
      const futurePredictions = this.extrapolate(trend, 7); // Next 7 days
      
      // Check if any threshold will be crossed
      const warnings = this.checkThresholds(futurePredictions, threshold, metricName, trend);
      
      if (warnings.length > 0) {
        predictions.push({
          metric: metricName,
          current: data[data.length - 1].value,
          trend: trend,
          predictions: futurePredictions,
          warnings: warnings,
          recommendedActions: this.getPreventiveActions(warnings, metricName),
          urgency: this.calculateUrgency(warnings),
          confidence: this.calculateConfidence(data, trend)
        });
      }
    });

    this.predictions = predictions;
    return predictions;
  }

  // Calculate trend from historical data
  calculateTrend(data) {
    if (data.length < 2) return { slope: 0, direction: 'stable', percentage: 0 };

    const recentData = data.slice(-10); // Last 10 data points
    const n = recentData.length;
    
    // Simple linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    recentData.forEach((point, index) => {
      sumX += index;
      sumY += point.value;
      sumXY += index * point.value;
      sumX2 += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate percentage change
    const firstValue = recentData[0].value;
    const lastValue = recentData[recentData.length - 1].value;
    const percentageChange = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    return {
      slope,
      intercept,
      direction: slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable',
      percentage: percentageChange,
      r2: this.calculateR2(recentData, slope, intercept)
    };
  }

  // Calculate R-squared for trend quality
  calculateR2(data, slope, intercept) {
    const n = data.length;
    if (n < 2) return 0;

    let sumY = 0, sumYhat = 0, sumYYhat = 0, sumY2 = 0;
    
    data.forEach((point, index) => {
      const y = point.value;
      const yhat = slope * index + intercept;
      
      sumY += y;
      sumYhat += yhat;
      sumYYhat += y * yhat;
      sumY2 += y * y;
    });

    const meanY = sumY / n;
    const meanYhat = sumYhat / n;
    
    const ssRes = data.reduce((sum, point, index) => {
      const yhat = slope * index + intercept;
      return sum + Math.pow(point.value - yhat, 2);
    }, 0);
    
    const ssTot = data.reduce((sum, point) => {
      return sum + Math.pow(point.value - meanY, 2);
    }, 0);

    return ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
  }

  // Extrapolate future values
  extrapolate(trend, days) {
    const predictions = [];
    const currentData = this.metrics[Object.keys(this.metrics).find(key => 
      this.metrics[key].length > 0
    )];
    
    if (!currentData || currentData.length === 0) return predictions;

    const lastTimestamp = currentData[currentData.length - 1].timestamp;
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = 1; i <= days; i++) {
      const futureTimestamp = lastTimestamp + (i * dayMs);
      const futureValue = trend.slope * (currentData.length + i) + trend.intercept;
      
      predictions.push({
        timestamp: futureTimestamp,
        daysFromNow: i,
        predictedValue: Math.max(0, futureValue), // Ensure non-negative
        confidence: Math.max(0.1, trend.r2 - (i * 0.1)) // Decreasing confidence
      });
    }

    return predictions;
  }

  // Check if thresholds will be crossed
  checkThresholds(predictions, threshold, metricName, trend) {
    const warnings = [];

    predictions.forEach(prediction => {
      const value = prediction.predictedValue;
      const date = new Date(prediction.timestamp).toLocaleDateString();

      // Check absolute thresholds
      if (value >= threshold.critical) {
        warnings.push({
          type: 'critical',
          metric: metricName,
          predictedValue: value,
          threshold: threshold.critical,
          date: date,
          daysFromNow: prediction.daysFromNow,
          message: `${metricName} will reach critical level (${value} >= ${threshold.critical}) on ${date}`
        });
      } else if (value >= threshold.warning) {
        warnings.push({
          type: 'warning',
          metric: metricName,
          predictedValue: value,
          threshold: threshold.warning,
          date: date,
          daysFromNow: prediction.daysFromNow,
          message: `${metricName} will reach warning level (${value} >= ${threshold.warning}) on ${date}`
        });
      }

      // Check trend thresholds
      if (Math.abs(trend.percentage) >= threshold.trend_critical) {
        warnings.push({
          type: 'trend_critical',
          metric: metricName,
          trend: trend.percentage,
          threshold: threshold.trend_critical,
          date: date,
          daysFromNow: prediction.daysFromNow,
          message: `${metricName} trend is critical (${trend.percentage.toFixed(1)}% change)`
        });
      } else if (Math.abs(trend.percentage) >= threshold.trend_warning) {
        warnings.push({
          type: 'trend_warning',
          metric: metricName,
          trend: trend.percentage,
          threshold: threshold.trend_warning,
          date: date,
          daysFromNow: prediction.daysFromNow,
          message: `${metricName} trend is concerning (${trend.percentage.toFixed(1)}% change)`
        });
      }
    });

    return warnings;
  }

  // Get preventive actions for warnings
  getPreventiveActions(warnings, metricName) {
    const actions = [];

    warnings.forEach(warning => {
      switch (metricName) {
        case 'database_response_time':
          if (warning.type === 'critical' || warning.type === 'trend_critical') {
            actions.push({
              action: 'Add database indexes',
              priority: 'HIGH',
              estimatedTime: '1 hour',
              impact: 'Reduce query time by 40-60%'
            });
            actions.push({
              action: 'Optimize slow queries',
              priority: 'HIGH',
              estimatedTime: '2 hours',
              impact: 'Improve overall performance'
            });
          } else {
            actions.push({
              action: 'Monitor query performance',
              priority: 'MEDIUM',
              estimatedTime: '30 minutes',
              impact: 'Early detection of issues'
            });
          }
          break;

        case 'storage_usage':
          if (warning.type === 'critical') {
            actions.push({
              action: 'Increase storage quota',
              priority: 'CRITICAL',
              estimatedTime: '15 minutes',
              impact: 'Prevent service interruption'
            });
            actions.push({
              action: 'Compress old media files',
              priority: 'HIGH',
              estimatedTime: '2 hours',
              impact: 'Free up 30-50% space'
            });
          } else {
            actions.push({
              action: 'Review storage usage patterns',
              priority: 'MEDIUM',
              estimatedTime: '1 hour',
              impact: 'Optimize storage strategy'
            });
          }
          break;

        case 'memory_consumption':
          actions.push({
            action: 'Restart services to clear memory',
            priority: 'HIGH',
            estimatedTime: '5 minutes',
            impact: 'Immediate memory relief'
          });
          actions.push({
            action: 'Optimize memory usage in code',
            priority: 'MEDIUM',
            estimatedTime: '4 hours',
            impact: 'Long-term memory efficiency'
          });
          break;

        case 'api_error_rate':
          actions.push({
            action: 'Review recent deployments',
            priority: 'HIGH',
            estimatedTime: '1 hour',
            impact: 'Identify breaking changes'
          });
          actions.push({
            action: 'Add error monitoring alerts',
            priority: 'MEDIUM',
              estimatedTime: '30 minutes',
            impact: 'Faster error detection'
          });
          break;

        case 'user_activity':
          actions.push({
            action: 'Check user experience issues',
            priority: 'HIGH',
            estimatedTime: '2 hours',
            impact: 'Improve user retention'
          });
          actions.push({
            action: 'Send user satisfaction survey',
            priority: 'MEDIUM',
            estimatedTime: '1 hour',
            impact: 'Gather user feedback'
          });
          break;

        case 'message_volume':
          actions.push({
            action: 'Scale messaging infrastructure',
            priority: 'HIGH',
            estimatedTime: '30 minutes',
            impact: 'Handle increased load'
          });
          actions.push({
            action: 'Optimize message processing',
            priority: 'MEDIUM',
            estimatedTime: '3 hours',
            impact: 'Improve efficiency'
          });
          break;

        case 'connection_pool_usage':
          actions.push({
            action: 'Increase connection pool size',
            priority: 'HIGH',
            estimatedTime: '5 minutes',
            impact: 'Prevent connection timeouts'
          });
          break;

        case 'cache_hit_rate':
          actions.push({
            action: 'Review caching strategy',
            priority: 'MEDIUM',
            estimatedTime: '2 hours',
            impact: 'Improve performance'
          });
          break;
      }
    });

    // Remove duplicate actions
    const uniqueActions = actions.filter((action, index, self) =>
      index === self.findIndex(a => a.action === action.action)
    );

    return uniqueActions;
  }

  // Calculate urgency based on warnings
  calculateUrgency(warnings) {
    const criticalWarnings = warnings.filter(w => w.type === 'critical' || w.type === 'trend_critical');
    const warningWarnings = warnings.filter(w => w.type === 'warning' || w.type === 'trend_warning');
    
    if (criticalWarnings.length > 0) {
      const daysToCritical = Math.min(...criticalWarnings.map(w => w.daysFromNow));
      if (daysToCritical <= 1) return 'IMMEDIATE';
      if (daysToCritical <= 3) return 'URGENT';
      return 'HIGH';
    }
    
    if (warningWarnings.length > 0) {
      const daysToWarning = Math.min(...warningWarnings.map(w => w.daysFromNow));
      if (daysToWarning <= 3) return 'MEDIUM';
      return 'LOW';
    }
    
    return 'LOW';
  }

  // Calculate confidence in predictions
  calculateConfidence(data, trend) {
    if (data.length < 10) return 0.3; // Low confidence with little data
    if (data.length < 20) return 0.5; // Medium confidence
    
    // High confidence if trend is strong and data is sufficient
    return Math.max(0.3, Math.min(0.95, trend.r2 * (data.length / 50)));
  }

  // Data collection helper methods
  async getStorageUsage() {
    // Simulate storage usage - would need actual storage API
    const currentUsage = 750; // MB
    const quota = 1000; // MB
    
    return {
      percentage: (currentUsage / quota) * 100,
      absolute: currentUsage,
      quota: quota
    };
  }

  async getMemoryUsage() {
    // Simulate memory usage - would need performance API
    const used = 450; // MB
    const available = 1024; // MB
    
    return {
      percentage: (used / available) * 100,
      absolute: used
    };
  }

  async getErrorRate() {
    // Simulate error rate calculation
    return Math.random() * 10; // 0-10%
  }

  async getUserActivity() {
    try {
      const { data: activeUsers, error } = await supabase
        .from('users')
        .select('id')
        .eq('is_online', true);
      
      const { count: totalUsers } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      return {
        active: activeUsers?.length || 0,
        total: totalUsers || 0
      };
    } catch (error) {
      return { active: 0, total: 0 };
    }
  }

  async getMessageVolume() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);
      
      return {
        count: count || 0,
        trend: 'stable' // Would calculate actual trend
      };
    } catch (error) {
      return { count: 0, trend: 'unknown' };
    }
  }

  async getConnectionPoolUsage() {
    // Simulate connection pool usage
    const active = 15;
    const max = 20;
    
    return {
      percentage: (active / max) * 100,
      active: active,
      max: max
    };
  }

  async getCacheHitRate() {
    // Simulate cache hit rate
    return 75 + Math.random() * 20; // 75-95%
  }

  // Get current predictions
  getPredictions() {
    return this.predictions;
  }

  // Get alerts for immediate attention
  getAlerts() {
    const immediateAlerts = [];
    
    this.predictions.forEach(prediction => {
      prediction.warnings.forEach(warning => {
        if (warning.daysFromNow <= 1 && (warning.type === 'critical' || warning.type === 'trend_critical')) {
          immediateAlerts.push({
            ...warning,
            metric: prediction.metric,
            current: prediction.current,
            trend: prediction.trend,
            confidence: prediction.confidence,
            actions: prediction.recommendedActions
          });
        }
      });
    });
    
    return immediateAlerts.sort((a, b) => a.daysFromNow - b.daysFromNow);
  }

  // Get system health forecast
  getHealthForecast() {
    const forecast = {
      overall: 'HEALTHY',
      next24Hours: [],
      next7Days: [],
      criticalIssues: 0,
      warnings: 0
    };

    this.predictions.forEach(prediction => {
      prediction.warnings.forEach(warning => {
        if (warning.daysFromNow <= 1) {
          forecast.next24Hours.push(warning);
        } else if (warning.daysFromNow <= 7) {
          forecast.next7Days.push(warning);
        }
        
        if (warning.type === 'critical' || warning.type === 'trend_critical') {
          forecast.criticalIssues++;
        } else {
          forecast.warnings++;
        }
      });
    });

    // Determine overall health
    if (forecast.criticalIssues > 0) {
      forecast.overall = 'CRITICAL';
    } else if (forecast.warnings > 2) {
      forecast.overall = 'WARNING';
    } else if (forecast.warnings > 0) {
      forecast.overall = 'CAUTION';
    }

    return forecast;
  }

  // Run complete predictive analysis
  async runPredictiveAnalysis() {
    await this.collectMetrics();
    return await this.analyzeTrends();
  }
}

export default PredictiveAnalyzer;
