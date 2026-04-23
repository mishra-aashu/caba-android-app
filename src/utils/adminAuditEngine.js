/**
 * Advanced Admin Audit Engine
 * Deep system testing with comprehensive diagnostics using specialized modules
 */

import DatabaseFeatureTests from './featureTestModules/databaseTests';
import AuthFeatureTests from './featureTestModules/authTests';
import MessagingFeatureTests from './featureTestModules/messagingTests';
import GroupFeatureTests from './featureTestModules/groupTests';
import MediaFeatureTests from './featureTestModules/mediaTests';
import NotificationFeatureTests from './featureTestModules/notificationTests';
import PerformanceFeatureTests from './featureTestModules/performanceTests';
import AdminFeatureTests from './featureTestModules/adminTests';

class AdminAuditEngine {
  constructor() {
    this.modules = {
      database: new DatabaseFeatureTests(),
      auth: new AuthFeatureTests(),
      messaging: new MessagingFeatureTests(),
      groups: new GroupFeatureTests(),
      media: new MediaFeatureTests(),
      notifications: new NotificationFeatureTests(),
      performance: new PerformanceFeatureTests(),
      admin: new AdminFeatureTests()
    };
    
    this.metrics = {
      startTime: null,
      endTime: null,
      totalDuration: 0,
      overallScore: 0,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      warningTests: 0
    };
  }

  // Run audit for a specific category
  async runCategoryAudit(categoryId) {
    const module = this.modules[categoryId];
    if (!module) {
      throw new Error(`Module for category ${categoryId} not found`);
    }

    const report = await module.runAllTests();
    return report;
  }

  // Run comprehensive system audit
  async runCompleteAudit() {
    this.metrics.startTime = performance.now();
    
    const results = {};
    const promises = Object.entries(this.modules).map(async ([categoryId, module]) => {
      try {
        const report = await module.runAllTests();
        results[categoryId] = report;
      } catch (error) {
        console.error(`Audit failed for ${categoryId}:`, error);
        results[categoryId] = {
          category: categoryId,
          summary: { overallStatus: 'fail', score: 0, pass: 0, fail: 1, warn: 0, total: 1 },
          tests: [{ testName: 'Module Execution', status: 'fail', message: error.message }],
          recommendations: [],
          criticalIssues: [{ test: 'Module Execution', message: error.message, severity: 'CRITICAL' }]
        };
      }
    });

    await Promise.all(promises);
    
    this.metrics.endTime = performance.now();
    this.metrics.totalDuration = Math.round(this.metrics.endTime - this.metrics.startTime);
    
    this.calculateOverallMetrics(results);

    return {
      metrics: this.metrics,
      results,
      timestamp: new Date().toISOString()
    };
  }

  // Calculate overall metrics
  calculateOverallMetrics(results) {
    let totalScore = 0;
    let categoryCount = 0;
    
    this.metrics.totalTests = 0;
    this.metrics.passedTests = 0;
    this.metrics.failedTests = 0;
    this.metrics.warningTests = 0;

    Object.values(results).forEach(report => {
      if (report && report.summary) {
        this.metrics.totalTests += report.summary.total || 0;
        this.metrics.passedTests += report.summary.pass || 0;
        this.metrics.failedTests += report.summary.fail || 0;
        this.metrics.warningTests += report.summary.warn || 0;
        totalScore += report.summary.score || 0;
        categoryCount++;
      }
    });

    this.metrics.overallScore = categoryCount > 0 ? Math.round(totalScore / categoryCount) : 0;
  }

  // Get all recommendations
  getAllRecommendations(results) {
    let recommendations = [];
    Object.values(results).forEach(report => {
      if (report && report.recommendations) {
        recommendations = [...recommendations, ...report.recommendations];
      }
    });
    return recommendations;
  }

  // Get all critical issues
  getAllCriticalIssues(results) {
    let criticalIssues = [];
    Object.values(results).forEach(report => {
      if (report && report.criticalIssues) {
        criticalIssues = [...criticalIssues, ...report.criticalIssues];
      }
    });
    return criticalIssues;
  }
}

export default AdminAuditEngine;
