import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  Shield, Activity, AlertTriangle, TrendingUp, Zap, Target, Layers,
  GitBranch, Package, Database, Users, MessageSquare, Clock, CheckCircle,
  XCircle, RefreshCw, Download, Upload, Eye, Brain, Heart, Network,
  BarChart3, PieChart as LucidePieChart, LineChart as LucideLineChart, Radar as LucideRadar, Settings, Bell, AlertCircle,
  TrendingDown, ArrowUp, ArrowDown, ZapOff, Wrench, ShieldOff,
  Radio, Wifi, WifiOff, Server, Cpu, HardDrive, Globe, Lock, Unlock,
  FileText, Search, Filter, Calendar, ChevronDown, ChevronUp, Info,
  Bug, Code, Terminal, TestTube, FlaskConical, Microscope, Stethoscope,
  ArrowRight
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  Area, AreaChart, ComposedChart, ScatterChart, Scatter
} from 'recharts';

// Import our advanced systems
import AdminAuditEngine from '../../utils/adminAuditEngine';
import RootCauseAnalyzer from '../../utils/RootCauseAnalyzer';
import SelfHealingSystem from '../../utils/SelfHealingSystem';
import PredictiveAnalyzer from '../../utils/PredictiveAnalyzer';
import DependencyMapper from '../../utils/DependencyMapper';
import './EnhancedAuditDashboard.css';

const COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  primary: '#2563eb',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#65a30d'
};

const EnhancedAuditDashboard = () => {
  const { supabase } = useSupabase();
  const { user: authUser } = useAuth();
  
  // System instances
  const [auditEngine] = useState(() => new AdminAuditEngine());
  const [rcaAnalyzer] = useState(() => new RootCauseAnalyzer());
  const [selfHealing] = useState(() => new SelfHealingSystem());
  const [predictiveAnalyzer] = useState(() => new PredictiveAnalyzer());
  const [dependencyMapper] = useState(() => new DependencyMapper());

  // State management
  const [activeView, setActiveView] = useState('overview');
  const [isRunning, setIsRunning] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [rcaAnalysis, setRcaAnalysis] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [healingHistory, setHealingHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);

  // Initialize systems
  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    try {
      const health = dependencyMapper.getSystemHealth();
      setSystemHealth(health);

      const history = selfHealing.getHealingHistory();
      setHealingHistory(history);

      const predictiveData = await predictiveAnalyzer.runPredictiveAnalysis();
      setPredictions(predictiveData);

      const currentAlerts = predictiveAnalyzer.getAlerts();
      setAlerts(currentAlerts);

    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      toast.error('Failed to initialize dashboard');
    }
  };

  // Run comprehensive audit
  const runComprehensiveAudit = async () => {
    setIsRunning(true);
    try {
      const auditData = await auditEngine.runCompleteAudit();
      setAuditResults(auditData);

      const failedTests = Object.values(auditData.results)
        .filter(result => result.summary.fail > 0)
        .flatMap(result => result.tests.filter(test => test.status === 'fail'));

      if (failedTests.length > 0) {
        const rcaResults = [];
        for (const failedTest of failedTests) {
          const analysis = await rcaAnalyzer.analyzeFailure(failedTest, auditData);
          rcaResults.push(analysis);
        }
        setRcaAnalysis(rcaResults);
      }

      for (const failedTest of failedTests) {
        const issueType = failedTest.testName.toLowerCase().replace(/\s+/g, '_');
        if (selfHealing.isFixable(issueType)) {
          const healingResult = await selfHealing.attemptHealing({
            type: issueType,
            testName: failedTest.testName,
            message: failedTest.message
          });
          
          if (healingResult.success) {
            toast.success(`Auto-fixed: ${failedTest.testName}`);
          }
        }
      }

      const predictiveData = await predictiveAnalyzer.runPredictiveAnalysis();
      setPredictions(predictiveData);

      const health = dependencyMapper.getSystemHealth();
      setSystemHealth(health);

      toast.success('Comprehensive audit completed!');

    } catch (error) {
      console.error('Comprehensive audit failed:', error);
      toast.error('Audit failed: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const getSystemMetrics = () => {
    if (!systemHealth) return [];
    return Object.entries(systemHealth.systems).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      health: data.health,
      components: data.components,
      status: data.status
    }));
  };

  const getPredictiveChartData = () => {
    return predictions.map(pred => ({
      metric: pred.metric.replace(/_/g, ' ').toUpperCase(),
      current: pred.current,
      trend: pred.trend.percentage,
      confidence: Math.round(pred.confidence * 100),
      urgency: pred.urgency
    }));
  };

  const getHealingStats = () => {
    const stats = selfHealing.getHealingStats();
    return [
      { name: 'Successful', value: stats.successful, color: COLORS.success },
      { name: 'Failed', value: stats.failed, color: COLORS.error },
      { name: 'In Progress', value: stats.currentlyHealing ? 1 : 0, color: COLORS.warning }
    ];
  };

  // Render overview section
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card health">
          <div className="metric-info">
            <h4>System Health</h4>
            <div className="metric-value">{systemHealth?.overallHealth || 0}%</div>
            <div className="metric-status">{systemHealth?.overall || 'UNKNOWN'}</div>
          </div>
          <Heart size={40} opacity={0.6} />
        </div>

        <div className="metric-card issues">
          <div className="metric-info">
            <h4>Active Issues</h4>
            <div className="metric-value">{alerts.length}</div>
            <div className="metric-status">Need attention</div>
          </div>
          <AlertTriangle size={40} opacity={0.6} />
        </div>

        <div className="metric-card predictions">
          <div className="metric-info">
            <h4>Predictions</h4>
            <div className="metric-value">{predictions.length}</div>
            <div className="metric-status">Future risks</div>
          </div>
          <Brain size={40} opacity={0.6} />
        </div>

        <div className="metric-card healing">
          <div className="metric-info">
            <h4>Auto-Healed</h4>
            <div className="metric-value">{healingHistory.filter(h => h.status === 'SUCCESS').length}</div>
            <div className="metric-status">Issues resolved</div>
          </div>
          <Zap size={40} opacity={0.6} />
        </div>
      </div>

      <div className="grid-2">
        <div className="data-container">
          <h3 className="mb-6">System Health Overview</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={getSystemMetrics()}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: '#f5f5f5'}} />
              <Bar dataKey="health" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Health %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="data-container">
          <h3 className="mb-6">Predictive Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={getPredictiveChartData()}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Current" dataKey="current" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} />
              <Radar name="Confidence" dataKey="confidence" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  // Render RCA section
  const renderRCA = () => (
    <div className="space-y-6">
      {rcaAnalysis && rcaAnalysis.length > 0 ? (
        rcaAnalysis.map((analysis, index) => (
          <div key={index} className="rca-item">
            <div className="container-header">
              <div>
                <h3>{analysis.testResult?.testName || 'Unknown Test'}</h3>
                <p style={{ marginTop: '4px', opacity: 0.7 }}>{analysis.rootCause}</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span className={`status-badge ${analysis.autoFixable ? 'success' : 'error'}`}>
                  {analysis.autoFixable ? 'Auto-Fixable' : 'Manual Fix'}
                </span>
                <span style={{ fontSize: '12px', opacity: 0.5 }}>{analysis.estimatedFixTime}</span>
              </div>
            </div>

            <div className="mb-6">
              <h4 style={{ fontSize: '14px', marginBottom: '12px', opacity: 0.6 }}>Investigation Chain</h4>
              <div className="space-y-2">
                {analysis.investigation.map((step, stepIndex) => (
                  <div key={stepIndex} className="investigation-step">
                    <div style={{ 
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: step.status === 'failed' ? COLORS.error : step.status === 'passed' ? COLORS.success : COLORS.warning
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>{step.check}</div>
                      <div style={{ fontSize: '12px', opacity: 0.6 }}>{step.issue || 'Check passed'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid-2">
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '12px', opacity: 0.6 }}>Affected Features</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {analysis.affectedFeatures.map((feature, idx) => (
                    <span key={idx} className="status-badge" style={{ background: '#eff6ff', color: '#1e40af' }}>{feature}</span>
                  ))}
                </div>
              </div>
              
              {analysis.userImpact && (
                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px', opacity: 0.6 }}>User Impact</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5 }}>Affected Users</div>
                      <div style={{ fontWeight: 700 }}>{analysis.userImpact.affectedUsers.toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.5 }}>Experience</div>
                      <div style={{ fontWeight: 700 }}>{analysis.userImpact.userExperience}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      ) : (
        <div className="data-container" style={{ textAlign: 'center', padding: '80px' }}>
          <Brain size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
          <p style={{ opacity: 0.6 }}>No root cause analysis available</p>
          <p style={{ fontSize: '13px', opacity: 0.4 }}>Run an audit to generate RCA reports</p>
        </div>
      )}
    </div>
  );

  // Render Self-Healing section
  const renderSelfHealing = () => (
    <div className="space-y-6">
      <div className="grid-2">
        <div className="data-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>Healing Performance</h3>
            <span className="status-badge success">Live Engine Active</span>
          </div>
          
          {healingHistory.length > 0 ? (
            <div className="grid-2">
              <ResponsiveContainer width="100%" height={200}>
                <RePieChart>
                  <Pie 
                    data={getHealingStats().total > 0 ? getHealingStats().data : [{ name: 'Ready', value: 1, color: '#e2e8f0' }]} 
                    cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value"
                  >
                    {getHealingStats().data?.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                <div className="investigation-step" style={{ background: 'rgba(16, 185, 129, 0.1)', color: COLORS.success }}>
                  <span style={{ flex: 1 }}>Success Rate</span>
                  <strong>{selfHealing.getHealingStats().successRate}%</strong>
                </div>
                <div className="investigation-step" style={{ background: 'rgba(59, 130, 246, 0.1)', color: COLORS.primary }}>
                  <span style={{ flex: 1 }}>Total Restorations</span>
                  <strong>{selfHealing.getHealingStats().total}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Zap size={48} color={COLORS.primary} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ opacity: 0.6, fontSize: '14px' }}>Waiting for system anomalies...</p>
              <div className="pulse-loader" style={{ margin: '20px auto' }}></div>
            </div>
          )}
        </div>

        <div className="data-container">
          <h3 style={{ marginBottom: '20px' }}>Recent Restorations</h3>
          {healingHistory.length > 0 ? (
            <div className="space-y-2" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {healingHistory.map((healing, index) => (
                <div key={index} className="investigation-step">
                  <div style={{ flex: 1 }}>
                    <strong>{healing.issueName}</strong>
                    <div style={{ fontSize: '11px', opacity: 0.5 }}>{healing.timestamp}</div>
                  </div>
                  <span className={`status-badge ${healing.status === 'SUCCESS' ? 'success' : 'error'}`}>{healing.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.4, textAlign: 'center', padding: '40px 0' }}>
              <Clock size={32} style={{ marginBottom: '12px' }} />
              <p style={{ fontSize: '13px' }}>No healing events recorded yet.</p>
            </div>
          )}
        </div>
      </div>

      <div className="data-container">
        <h3 style={{ marginBottom: '24px' }}>Automated Healing Capabilities</h3>
        <div className="capabilities-grid">
          {selfHealing.getAvailableFixes().map((fix, idx) => (
            <div key={idx} className="capability-card">
              <div className="capability-header">
                <div className="capability-icon">
                  {fix.priority === 'HIGH' ? <Zap size={16} /> : <Wrench size={16} />}
                </div>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>{fix.name}</span>
              </div>
              <div className="capability-meta">
                <span className={`priority-dot ${fix.priority.toLowerCase()}`}></span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>{fix.estimatedTime} fix time</span>
              </div>
              <div className="capability-badges">
                {fix.autoFix && <span className="mini-badge">AUTO</span>}
                <span className="mini-badge risk">{fix.risk} RISK</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPredictive = () => (
    <div className="space-y-6">
      {/* Risk Alert Banner */}
      {alerts.length > 0 && (
        <div className="predictive-alert-banner">
          <div className="alert-content">
            <Brain size={32} className="alert-icon-pulse" />
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>AI Predicted System Vulnerabilities</h3>
              <p style={{ margin: '4px 0 0 0', opacity: 0.8, fontSize: '14px' }}>
                Our predictive engine has identified {alerts.length} critical trends that require immediate intervention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Forecast & Matrix */}
      <div className="grid-2">
        <div className="data-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>Infrastructure Load Forecast</h3>
            <span className="status-badge" style={{ background: '#eff6ff', color: '#1e40af' }}>7-Day Projection</span>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={predictions.flatMap(pred => pred.predictions.map(p => ({ 
              metric: pred.metric.replace(/_/g, ' ').toUpperCase(), 
              day: `Day ${p.daysFromNow}`, 
              value: Math.round(p.predictedValue),
              confidence: Math.round(p.confidence * 100)
            })))}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="value" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="data-container">
          <h3 style={{ marginBottom: '24px' }}>Risk Assessment Matrix</h3>
          <div className="risk-matrix">
            <div className="matrix-y-label">PROBABILITY</div>
            <div className="matrix-content">
              {predictions.slice(0, 4).map((pred, idx) => (
                <div key={idx} className={`risk-node ${pred.urgency.toLowerCase()}`}>
                  <div className="risk-dot" style={{ 
                    transform: `translate(${pred.confidence * 100}px, ${-(pred.trend.percentage / 2)}px)` 
                  }}>
                    <div className="dot-ripple"></div>
                    <div className="dot-core"></div>
                    <div className="dot-tooltip">{pred.metric.replace(/_/g, ' ')}</div>
                  </div>
                </div>
              ))}
              <div className="matrix-background">
                <div className="quadrant q1">CRITICAL</div>
                <div className="quadrant q2">HIGH</div>
                <div className="quadrant q3">MEDIUM</div>
                <div className="quadrant q4">LOW</div>
              </div>
            </div>
            <div className="matrix-x-label">IMPACT / SEVERITY</div>
          </div>
        </div>
      </div>

      {/* AI Insights & Recommendations */}
      <div className="data-container">
        <h3 style={{ marginBottom: '20px' }}>AI-Generated Preventive Strategy</h3>
        <div className="grid-2">
          <div className="ai-insight-box">
            <div className="insight-header">
              <Microscope size={20} color={COLORS.primary} />
              <span>Anomaly Detection Analysis</span>
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, opacity: 0.8 }}>
              Based on recent trends in <strong>{predictions[0]?.metric || 'system'}</strong> performance, we observe a 
              {predictions[0]?.trend.direction} trajectory. The system's behavior suggests a 
              potential bottleneck forming within the next {predictions[0]?.warnings[0]?.daysFromNow || 'X'} days.
            </p>
          </div>
          
          <div className="recommendations-scroll">
            {predictions.flatMap(p => p.recommendedActions).slice(0, 4).map((action, idx) => (
              <div key={idx} className="predictive-action-card">
                <div className="action-main">
                  <Zap size={18} color={COLORS.warning} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{action.action}</div>
                    <div style={{ fontSize: '12px', opacity: 0.6 }}>IMPACT: {action.impact}</div>
                  </div>
                </div>
                <span className={`priority-tag ${action.priority.toLowerCase()}`}>{action.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDependencies = () => (
    <div className="space-y-6">
      <div className="data-container">
        <h3>Infrastructure Dependency Graph</h3>
        <div className="grid-2" style={{ marginTop: '24px' }}>
          {Object.entries(dependencyMapper.dependencyGraph).map(([name, system]) => (
            <div key={name} className="rca-item">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                <strong>{system.name}</strong>
                <span className="status-badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>{system.type}</span>
              </div>
              <div className="space-y-2">
                {Object.entries(system.components || {}).map(([cName, comp]) => (
                  <div key={cName} className="investigation-step">
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: comp.health >= 90 ? '#10b981' : '#f59e0b' }} />
                    <span style={{ flex: 1, fontSize: '13px' }}>{comp.name}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{comp.health}%</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="audit-dashboard-root">
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="header-icon-box">
            <Shield size={32} />
          </div>
          <div className="header-text">
            <h1>Enhanced System Audit</h1>
            <p>AI-powered diagnostics and self-healing</p>
          </div>
        </div>
        
        <button onClick={runComprehensiveAudit} disabled={isRunning} className="btn-comprehensive">
          {isRunning ? (
            <>
              <RefreshCw size={20} className="spin" />
              <span>Running Analysis...</span>
            </>
          ) : (
            <>
              <Brain size={20} />
              <span>Run Comprehensive Audit</span>
            </>
          )}
        </button>
      </header>

      <nav className="dashboard-nav">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'rca', label: 'Root Cause Analysis', icon: Search },
          { id: 'healing', label: 'Self-Healing', icon: Zap },
          { id: 'predictive', label: 'Predictive Analysis', icon: Brain },
          { id: 'dependencies', label: 'Dependencies', icon: Network }
        ].map(view => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`nav-tab ${activeView === view.id ? 'active' : ''}`}
          >
            <view.icon size={16} />
            <span>{view.label}</span>
          </button>
        ))}
      </nav>

      <main className="dashboard-content">
        {activeView === 'overview' && renderOverview()}
        {activeView === 'rca' && renderRCA()}
        {activeView === 'healing' && renderSelfHealing()}
        {activeView === 'predictive' && renderPredictive()}
        {activeView === 'dependencies' && renderDependencies()}
      </main>
    </div>
  );
};

export default EnhancedAuditDashboard;

