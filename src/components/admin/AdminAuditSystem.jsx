import React, { useState } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Database,
  Users, MessageSquare, FileText, Radio, Activity,
  Clock, RefreshCw, ChevronDown, ChevronUp, Info, TestTube, Zap
} from 'lucide-react';
import AdminAuditEngine from '../../utils/adminAuditEngine';
import './Admin.css';

const engine = new AdminAuditEngine();

const FEATURE_CATEGORIES = {
  database: { name: 'Database Connectivity', icon: Database },
  auth: { name: 'Authentication System', icon: Shield },
  messaging: { name: 'Messaging System', icon: MessageSquare },
  groups: { name: 'Group Features', icon: Users },
  media: { name: 'Media & Files', icon: FileText },
  notifications: { name: 'Notifications', icon: Radio },
  performance: { name: 'Performance', icon: Activity },
  admin: { name: 'Admin Features', icon: Shield }
};

const AdminAuditSystem = () => {
  const { supabase } = useSupabase();
  const { user: authUser } = useAuth();
  
  const [auditResults, setAuditResults] = useState({});
  const [metrics, setMetrics] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState({});
  const [expandedCategories, setExpandedCategories] = useState(new Set(['database']));
  const [recommendations, setRecommendations] = useState([]);
  const [criticalIssues, setCriticalIssues] = useState([]);

  const runFullAudit = async () => {
    setIsRunning(true);
    
    try {
      const response = await engine.runCompleteAudit();
      
      setAuditResults(response.results);
      setMetrics(response.metrics);
      
      const recs = engine.getAllRecommendations(response.results);
      const issues = engine.getAllCriticalIssues(response.results);
      
      setRecommendations(recs);
      setCriticalIssues(issues);
      
      const auditData = {
        id: `audit_${Date.now()}`,
        timestamp: response.timestamp,
        duration: response.metrics.totalDuration,
        results: response.results,
        summary: {
          pass: response.metrics.passedTests,
          fail: response.metrics.failedTests,
          warn: response.metrics.warningTests,
        },
        performedBy: authUser?.id
      };
      
      try {
        await supabase.from('admin_audit_logs').insert({
          admin_id: authUser.id,
          audit_id: auditData.id,
          action: 'full_system_audit',
          results: auditData,
          duration: auditData.duration,
          summary: auditData.summary
        });
      } catch (error) {
        console.error('Failed to log audit:', error);
      }
      
      toast.success(`Audit completed in ${auditData.duration}ms`);
      
    } catch (error) {
      console.error('Audit failed:', error);
      toast.error('Audit failed: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass': return <CheckCircle size={16} color="var(--admin-green)" />;
      case 'fail': return <XCircle size={16} color="var(--admin-red)" />;
      case 'warn': return <AlertTriangle size={16} color="var(--admin-orange)" />;
      default: return <Info size={16} color="var(--admin-text-muted)" />;
    }
  };

  const healthScore = metrics.overallScore || 0;

  return (
    <div className="admin-root">
      <div className="main-content">
        
        {/* Section Header */}
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'var(--admin-blue-light)', padding: '10px', borderRadius: 'var(--admin-radius-md)' }}>
              <Shield size={24} color="var(--admin-blue)" />
            </div>
            <div>
              <h2 style={{ margin: '0' }}>System Audit & Diagnostics</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--admin-text-muted)' }}>Deep infrastructure testing and automated health monitoring</p>
            </div>
          </div>
          
          <div className="header-actions">
            <div style={{ textAlign: 'center', padding: '8px 16px', background: 'var(--admin-bg-primary)', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border-light)' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: healthScore > 80 ? 'var(--admin-green)' : healthScore > 50 ? 'var(--admin-orange)' : 'var(--admin-red)' }}>
                {healthScore}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--admin-text-muted)', textTransform: 'uppercase' }}>Health Score</div>
            </div>
            
            <button
              onClick={runFullAudit}
              disabled={isRunning}
              className="action-btn"
              style={{ padding: '12px 24px', height: '100%' }}
            >
              {isRunning ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  Running Diagnostics...
                </>
              ) : (
                <>
                  <TestTube size={18} />
                  Run Deep Audit
                </>
              )}
            </button>
          </div>
        </div>

        {/* Critical Issues Banner */}
        {criticalIssues.length > 0 && (
          <div style={{ marginBottom: '24px', background: 'var(--admin-red-light)', borderLeft: '4px solid var(--admin-red)', padding: '20px', borderRadius: '0 var(--admin-radius-md) var(--admin-radius-md) 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <AlertTriangle size={20} color="var(--admin-red)" />
              <h3 style={{ margin: 0, color: 'var(--admin-red-text)', fontSize: '18px' }}>Critical Issues Detected ({criticalIssues.length})</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {criticalIssues.map((issue, idx) => (
                <div key={idx} style={{ background: 'var(--admin-bg-primary)', padding: '16px', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-red-light)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <XCircle size={18} color="var(--admin-red)" style={{ marginTop: '2px' }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{issue.test}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-secondary)' }}>{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="quick-actions" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Zap size={20} color="var(--admin-blue)" />
              <h3 style={{ margin: 0, color: 'var(--admin-text-primary)' }}>AI Recommendations</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recommendations.map((rec, idx) => (
                <div key={idx} style={{ background: 'var(--admin-bg-secondary)', padding: '16px', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{rec.issue}</h4>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--admin-text-muted)' }}>{rec.solution}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: 'var(--admin-radius-pill)', background: rec.priority === 'CRITICAL' ? 'var(--admin-red-light)' : rec.priority === 'HIGH' ? 'var(--admin-yellow-light)' : 'var(--admin-blue-light)', color: rec.priority === 'CRITICAL' ? 'var(--admin-red-text)' : rec.priority === 'HIGH' ? 'var(--admin-yellow-text)' : 'var(--admin-blue)' }}>
                      {rec.priority}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={14} />
                      {rec.estimatedTime}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        {Object.keys(auditResults).length > 0 && (
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--admin-green)' }}>
                <CheckCircle size={24} />
              </div>
              <div className="stat-info">
                <h3>{metrics.passedTests || 0}</h3>
                <p>Tests Passed</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--admin-red)' }}>
                <XCircle size={24} />
              </div>
              <div className="stat-info">
                <h3>{metrics.failedTests || 0}</h3>
                <p>Tests Failed</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--admin-orange)' }}>
                <AlertTriangle size={24} />
              </div>
              <div className="stat-info">
                <h3>{metrics.warningTests || 0}</h3>
                <p>Warnings</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'var(--admin-blue)' }}>
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <h3>{metrics.totalDuration || 0}ms</h3>
                <p>Total Duration</p>
              </div>
            </div>
          </div>
        )}

        {/* Audit Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(auditResults).map(([categoryKey, categoryData]) => {
            const config = FEATURE_CATEGORIES[categoryKey] || { name: categoryKey, icon: Info };
            const isExpanded = expandedCategories.has(categoryKey);
            const Icon = config.icon;
            
            return (
              <div key={categoryKey} style={{ background: 'var(--admin-bg-primary)', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border-light)', overflow: 'hidden' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', cursor: 'pointer', background: isExpanded ? 'var(--admin-bg-hover)' : 'transparent' }}
                  onClick={() => toggleCategory(categoryKey)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '8px', background: 'var(--admin-bg-tertiary)', borderRadius: 'var(--admin-radius-md)' }}>
                      <Icon size={20} color="var(--admin-text-secondary)" />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '18px' }}>{config.name}</h3>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                        <span style={{ color: 'var(--admin-green)' }}>{categoryData.summary.pass} passed</span>
                        {categoryData.summary.fail > 0 && <span style={{ color: 'var(--admin-red)' }}>{categoryData.summary.fail} failed</span>}
                        {categoryData.summary.warn > 0 && <span style={{ color: 'var(--admin-orange)' }}>{categoryData.summary.warn} warnings</span>}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ padding: '4px 12px', borderRadius: 'var(--admin-radius-pill)', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', background: categoryData.summary.overallStatus === 'pass' ? 'var(--admin-green-light)' : categoryData.summary.overallStatus === 'warn' ? 'var(--admin-yellow-light)' : 'var(--admin-red-light)', color: categoryData.summary.overallStatus === 'pass' ? 'var(--admin-green-text)' : categoryData.summary.overallStatus === 'warn' ? 'var(--admin-yellow-text)' : 'var(--admin-red-text)' }}>
                      {categoryData.summary.overallStatus}
                    </div>
                    {isExpanded ? <ChevronUp size={20} color="var(--admin-text-muted)" /> : <ChevronDown size={20} color="var(--admin-text-muted)" />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--admin-border-light)', background: 'var(--admin-bg-secondary)', padding: '20px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
                      {categoryData.tests.map((testResult, idx) => (
                        <div key={idx} style={{ background: 'var(--admin-bg-primary)', border: '1px solid var(--admin-border-light)', borderRadius: 'var(--admin-radius-md)', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {getStatusIcon(testResult.status)}
                              <h4 style={{ margin: 0, fontSize: '15px' }}>{testResult.testName}</h4>
                            </div>
                            {testResult.executionTime !== undefined && (
                              <span style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--admin-bg-tertiary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--admin-text-muted)' }}>
                                {testResult.executionTime}ms
                              </span>
                            )}
                          </div>
                          
                          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: testResult.status === 'fail' ? 'var(--admin-red)' : 'var(--admin-text-secondary)' }}>
                            {testResult.message}
                          </p>
                          
                          {showDetails[`${categoryKey}-${idx}`] && testResult.details && (
                            <div style={{ marginTop: '12px', padding: '12px', background: '#1a1d21', color: '#e4e6eb', borderRadius: 'var(--admin-radius-sm)', fontSize: '11px', fontFamily: 'monospace', overflowX: 'auto' }}>
                              <pre style={{ margin: 0 }}>{JSON.stringify(testResult.details, null, 2)}</pre>
                            </div>
                          )}
                          
                          {testResult.details && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDetails(prev => ({
                                  ...prev,
                                  [`${categoryKey}-${idx}`]: !prev[`${categoryKey}-${idx}`]
                                }));
                              }}
                              style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px', fontWeight: 'bold', color: 'var(--admin-blue)', cursor: 'pointer', textTransform: 'uppercase' }}
                            >
                              {showDetails[`${categoryKey}-${idx}`] ? 'Hide Details' : 'View Raw Details'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
      </div>
    </div>
  );
};

export default AdminAuditSystem;
