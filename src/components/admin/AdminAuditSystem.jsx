import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, Database,
  Users, MessageSquare, FileText, Radio, Activity,
  Clock, RefreshCw, ChevronDown, ChevronUp, Info, TestTube, Zap,
  Terminal, Search, Copy
} from 'lucide-react';
import AdminAuditEngine from '../../utils/adminAuditEngine';
import './AdminAuditSystem.css';

const engine = new AdminAuditEngine();

const FEATURE_CATEGORIES = {
  database: { name: 'Database Connectivity', icon: Database, color: '#3b82f6' },
  auth: { name: 'Authentication System', icon: Shield, color: '#8b5cf6' },
  messaging: { name: 'Messaging System', icon: MessageSquare, color: '#10b981' },
  groups: { name: 'Group Features', icon: Users, color: '#f59e0b' },
  media: { name: 'Media & Files', icon: FileText, color: '#ec4899' },
  notifications: { name: 'Notifications', icon: Radio, color: '#06b6d4' },
  performance: { name: 'Performance', icon: Activity, color: '#6366f1' },
  admin: { name: 'Admin Features', icon: Shield, color: '#f43f5e' }
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
  const [searchQuery, setSearchQuery] = useState('');

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Trace copied to clipboard');
  };

  const runFullAudit = async () => {
    setIsRunning(true);
    setAuditResults({}); // Clear previous results to show "scanning" feel
    
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass': return '#10b981';
      case 'fail': return '#ef4444';
      case 'warn': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const healthScore = metrics.overallScore || 0;
  const scoreColor = healthScore > 80 ? '#10b981' : healthScore > 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="admin-audit-container">
      {/* Header Section */}
      <header className="audit-header-glass">
        <div className="audit-title-area">
          <div className="audit-icon-wrapper">
            <Shield size={32} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>System Diagnostics</h1>
            <p style={{ margin: '4px 0 0 0', opacity: 0.7 }}>Infrastructure monitoring & deep system audit</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div className="health-score-container" style={{ '--score-color': scoreColor, '--score-percent': `${healthScore * 3.6}deg` }}>
            <div className="health-score-ring"></div>
            <div className="health-score-value">{healthScore}%</div>
            <div style={{ position: 'absolute', bottom: '-20px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 700, color: '#888' }}>Health</div>
          </div>

          <button
            onClick={runFullAudit}
            disabled={isRunning}
            className="btn-audit-pulse"
          >
            {isRunning ? (
              <>
                <RefreshCw size={20} className="spin" />
                <span>Scanning System...</span>
              </>
            ) : (
              <>
                <TestTube size={20} />
                <span>Run Deep Audit</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <section className="critical-banner-premium">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <AlertTriangle size={24} color="#ef4444" />
            <h2 style={{ margin: 0, color: '#b91c1c' }}>Critical System Alerts ({criticalIssues.length})</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {criticalIssues.map((issue, idx) => (
              <div key={idx} className="stat-card-premium" style={{ borderLeft: '4px solid #ef4444', position: 'relative' }}>
                <XCircle size={20} color="#ef4444" />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0' }}>{issue.test}</h4>
                  <p style={{ margin: 0, fontSize: '13px', opacity: 0.8 }}>{issue.message}</p>
                </div>
                <button
                  onClick={() => handleCopy(`${issue.test}: ${issue.message}`)}
                  style={{
                    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                    padding: '8px', borderRadius: '50%'
                  }}
                  title="Copy Error"
                  className="copy-btn-hover"
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <section className="ai-recs-container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Zap size={20} color="#3b82f6" />
            <h3 style={{ margin: 0 }}>Infrastructure Optimization Recommendations</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recommendations.map((rec, idx) => (
              <div key={idx} className="rec-item-glass" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '8px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px' }}>
                    <Info size={18} color="#3b82f6" />
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 2px 0' }}>{rec.issue}</h4>
                    <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>{rec.solution}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ 
                    fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px',
                    background: rec.priority === 'CRITICAL' ? '#fee2e2' : '#fef3c7',
                    color: rec.priority === 'CRITICAL' ? '#ef4444' : '#d97706'
                  }}>
                    {rec.priority}
                  </span>
                  <button
                    onClick={() => handleCopy(`Issue: ${rec.issue}\nSolution: ${rec.solution}`)}
                    style={{
                      background: 'none', border: 'none', color: '#999', cursor: 'pointer',
                      padding: '8px', borderRadius: '50%'
                    }}
                    title="Copy Solution"
                    className="copy-btn-hover"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Stats Grid */}
      {Object.keys(auditResults).length > 0 && (
        <section className="audit-stats-grid">
          <div className="stat-card-premium">
            <div className="stat-icon-box" style={{ background: '#10b981' }}>
              <CheckCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800 }}>{metrics.passedTests || 0}</div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.6 }}>Tests Passed</div>
            </div>
          </div>
          <div className="stat-card-premium">
            <div className="stat-icon-box" style={{ background: '#ef4444' }}>
              <XCircle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800 }}>{metrics.failedTests || 0}</div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.6 }}>Tests Failed</div>
            </div>
          </div>
          <div className="stat-card-premium">
            <div className="stat-icon-box" style={{ background: '#f59e0b' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800 }}>{metrics.warningTests || 0}</div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.6 }}>Warnings</div>
            </div>
          </div>
          <div className="stat-card-premium">
            <div className="stat-icon-box" style={{ background: '#3b82f6' }}>
              <Activity size={24} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 800 }}>{metrics.totalDuration || 0}ms</div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', opacity: 0.6 }}>Execution Time</div>
            </div>
          </div>
        </section>
      )}

      {/* Audit Category Details */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Object.entries(auditResults).map(([categoryKey, categoryData]) => {
          const config = FEATURE_CATEGORIES[categoryKey] || { name: categoryKey, icon: Info, color: '#6b7280' };
          const isExpanded = expandedCategories.has(categoryKey);
          const Icon = config.icon;
          
          return (
            <div key={categoryKey} className="audit-category-card">
              <div className="audit-category-header" onClick={() => toggleCategory(categoryKey)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ padding: '12px', background: `${config.color}15`, borderRadius: '12px', color: config.color }}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px' }}>{config.name}</h3>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', marginTop: '4px' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>{categoryData.summary.pass} OK</span>
                      {categoryData.summary.fail > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>{categoryData.summary.fail} FAIL</span>}
                      {categoryData.summary.warn > 0 && <span style={{ color: '#f59e0b', fontWeight: 600 }}>{categoryData.summary.warn} WARN</span>}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ 
                    padding: '6px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase',
                    background: categoryData.summary.overallStatus === 'pass' ? '#d1fae5' : '#fee2e2',
                    color: categoryData.summary.overallStatus === 'pass' ? '#059669' : '#dc2626'
                  }}>
                    {categoryData.summary.overallStatus === 'pass' ? 'System Stable' : 'Action Required'}
                  </div>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              
              {isExpanded && (
                <div className="test-grid-layout">
                  {categoryData.tests.map((testResult, idx) => (
                    <div key={idx} className="test-result-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="test-status-indicator" style={{ background: getStatusColor(testResult.status) }}></div>
                          <h4 style={{ margin: 0, fontSize: '15px' }}>{testResult.testName}</h4>
                        </div>
                        {testResult.executionTime !== undefined && (
                          <span style={{ fontSize: '10px', opacity: 0.5, fontFamily: 'monospace' }}>{testResult.executionTime}ms</span>
                        )}
                      </div>
                      
                      <p style={{ margin: 0, fontSize: '13px', opacity: 0.8, lineHeight: 1.5 }}>
                        {testResult.message}
                      </p>
                      
                      {testResult.details && (
                        <div style={{ marginTop: '10px' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDetails(prev => ({
                                ...prev,
                                [`${categoryKey}-${idx}`]: !prev[`${categoryKey}-${idx}`]
                              }));
                            }}
                            className="btn-secondary"
                            style={{ 
                              background: 'none', border: '1px solid #ddd', padding: '4px 12px', fontSize: '11px', 
                              borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' 
                            }}
                          >
                            <Terminal size={12} />
                            {showDetails[`${categoryKey}-${idx}`] ? 'Hide Raw' : 'Raw Trace'}
                          </button>
                          
                          {showDetails[`${categoryKey}-${idx}`] && (
                            <div className="raw-details-console" style={{ position: 'relative' }}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(JSON.stringify(testResult.details, null, 2));
                                }}
                                style={{
                                  position: 'absolute', top: '10px', right: '10px',
                                  background: 'rgba(255, 255, 255, 0.1)', border: 'none',
                                  borderRadius: '4px', color: '#38bdf8', cursor: 'pointer',
                                  padding: '4px', display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                                title="Copy Trace"
                              >
                                <Copy size={14} />
                              </button>
                              <pre>{JSON.stringify(testResult.details, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default AdminAuditSystem;

