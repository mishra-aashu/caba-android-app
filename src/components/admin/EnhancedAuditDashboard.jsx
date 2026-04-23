/**
 * Enhanced Audit Dashboard with Advanced Features
 * Integrates RCA, Self-Healing, Predictive Analysis, and Dependency Mapping
 */

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
import './tailwind-shim.css';

const COLORS = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  primary: '#6366f1',
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
  const [expandedSections, setExpandedSections] = useState(new Set(['overview', 'critical']));

  // Initialize systems
  useEffect(() => {
    initializeDashboard();
  }, []);

  const initializeDashboard = async () => {
    try {
      // Get system health
      const health = dependencyMapper.getSystemHealth();
      setSystemHealth(health);

      // Get healing history
      const history = selfHealing.getHealingHistory();
      setHealingHistory(history);

      // Run predictive analysis
      const predictiveData = await predictiveAnalyzer.runPredictiveAnalysis();
      setPredictions(predictiveData);

      // Get current alerts
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
      // Step 1: Run basic audit
      const auditData = await auditEngine.runCompleteAudit();
      setAuditResults(auditData);

      // Step 2: Analyze failures with RCA
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

      // Step 3: Attempt self-healing for fixable issues
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

      // Step 4: Update predictions
      const predictiveData = await predictiveAnalyzer.runPredictiveAnalysis();
      setPredictions(predictiveData);

      // Step 5: Update system health
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

  // Get system metrics for charts
  const getSystemMetrics = () => {
    if (!systemHealth) return [];

    return Object.entries(systemHealth.systems).map(([name, data]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      health: data.health,
      components: data.components,
      status: data.status
    }));
  };

  // Get predictive data for charts
  const getPredictiveChartData = () => {
    return predictions.map(pred => ({
      metric: pred.metric.replace(/_/g, ' ').toUpperCase(),
      current: pred.current,
      trend: pred.trend.percentage,
      confidence: Math.round(pred.confidence * 100),
      urgency: pred.urgency
    }));
  };

  // Get healing statistics
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 text-sm font-medium">System Health</p>
              <p className="text-2xl font-bold text-green-900">{systemHealth?.overallHealth || 0}%</p>
              <p className="text-green-700 text-xs">{systemHealth?.overall || 'UNKNOWN'}</p>
            </div>
            <Heart className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 text-sm font-medium">Active Issues</p>
              <p className="text-2xl font-bold text-blue-900">{alerts.length}</p>
              <p className="text-blue-700 text-xs">Need attention</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 text-sm font-medium">Predictions</p>
              <p className="text-2xl font-bold text-purple-900">{predictions.length}</p>
              <p className="text-purple-700 text-xs">Future risks</p>
            </div>
            <Brain className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border border-orange-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 text-sm font-medium">Auto-Healed</p>
              <p className="text-2xl font-bold text-orange-900">{healingHistory.filter(h => h.status === 'SUCCESS').length}</p>
              <p className="text-orange-700 text-xs">Issues resolved</p>
            </div>
            <Zap className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* System Health Chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health Overview</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={getSystemMetrics()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="health" fill={COLORS.primary} name="Health %" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Predictive Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Predictive Analysis</h3>
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
  );

  // Render RCA section
  const renderRCA = () => (
    <div className="space-y-6">
      {rcaAnalysis && rcaAnalysis.length > 0 ? (
        rcaAnalysis.map((analysis, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {analysis.testResult?.testName || 'Unknown Test'}
                </h3>
                <p className="text-sm text-gray-600 mt-1">{analysis.rootCause}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  analysis.autoFixable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {analysis.autoFixable ? 'Auto-Fixable' : 'Manual Fix Required'}
                </span>
                <span className="text-sm text-gray-500">{analysis.estimatedFixTime}</span>
              </div>
            </div>

            {/* Investigation Chain */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Investigation Chain</h4>
              <div className="space-y-2">
                {analysis.investigation.map((step, stepIndex) => (
                  <div key={stepIndex} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${
                      step.status === 'failed' ? 'bg-red-500' : 
                      step.status === 'passed' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{step.check}</p>
                      <p className="text-xs text-gray-600">{step.issue || 'Check passed'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Affected Features */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Affected Features</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.affectedFeatures.map((feature, featureIndex) => (
                  <span key={featureIndex} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* User Impact */}
            {analysis.userImpact && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">User Impact</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Affected Users</p>
                    <p className="text-lg font-semibold text-gray-900">{analysis.userImpact.affectedUsers.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Business Impact</p>
                    <p className="text-lg font-semibold text-gray-900">{analysis.userImpact.businessImpact}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Urgency</p>
                    <p className="text-lg font-semibold text-gray-900">{analysis.userImpact.urgency}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Experience</p>
                    <p className="text-lg font-semibold text-gray-900">{analysis.userImpact.userExperience}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Fixes */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Suggested Fixes</h4>
              <div className="space-y-2">
                {analysis.suggestedFixes.map((fix, fixIndex) => (
                  <div key={fixIndex} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-green-900">{fix.action}</p>
                      <p className="text-xs text-green-700">{fix.condition}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-green-600">{fix.estimatedTime}</p>
                      <p className="text-xs text-green-600">{fix.autoFixable ? 'Auto-fixable' : 'Manual'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
          <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No root cause analysis available</p>
          <p className="text-sm text-gray-500 mt-2">Run an audit to generate RCA reports</p>
        </div>
      )}
    </div>
  );

  // Render Self-Healing section
  const renderSelfHealing = () => (
    <div className="space-y-6">
      {/* Healing Statistics */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Self-Healing Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <RePieChart>
                <Pie
                  data={getHealingStats()}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {getHealingStats().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </RePieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <span className="text-green-700">Success Rate</span>
              <span className="font-semibold text-green-900">
                {selfHealing.getHealingStats().successRate}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-blue-700">Total Attempts</span>
              <span className="font-semibold text-blue-900">
                {selfHealing.getHealingStats().total}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="text-purple-700">Currently Healing</span>
              <span className="font-semibold text-purple-900">
                {selfHealing.getHealingStats().currentlyHealing ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Healing History */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Healing History</h3>
        <div className="space-y-3">
          {healingHistory.length > 0 ? (
            healingHistory.map((healing, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{healing.issueName}</p>
                  <p className="text-sm text-gray-600">{healing.timestamp}</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    healing.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                    healing.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {healing.status}
                  </span>
                  {healing.executionTime && (
                    <span className="text-sm text-gray-500">{healing.executionTime}ms</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500 py-8">No healing history available</p>
          )}
        </div>
      </div>

      {/* Available Fixes */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Auto-Fixes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {selfHealing.getAvailableFixes().map((fix, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{fix.name}</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  fix.autoFix ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {fix.autoFix ? 'Auto' : 'Manual'}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Time:</span> {fix.estimatedTime}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Risk:</span> {fix.risk}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Priority:</span> {fix.priority}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render Predictive Analysis section
  const renderPredictive = () => (
    <div className="space-y-6">
      {/* Current Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Immediate Alerts</h3>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div key={index} className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">{alert.message}</p>
                  <p className="text-sm text-red-700 mt-1">
                    Metric: {alert.metric} | Current: {alert.current} | 
                    Predicted: {alert.predictedValue} in {alert.daysFromNow} days
                  </p>
                  <div className="mt-2">
                    <p className="text-xs text-red-600 font-medium">Recommended Actions:</p>
                    <ul className="text-xs text-red-700 mt-1 list-disc list-inside">
                      {alert.actions.map((action, actionIndex) => (
                        <li key={actionIndex}>{action.action} ({action.estimatedTime})</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictions Chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">7-Day Predictions</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={predictions.flatMap(pred => 
            pred.predictions.map(prediction => ({
              metric: pred.metric,
              date: `Day ${prediction.daysFromNow}`,
              value: prediction.predictedValue,
              confidence: prediction.confidence
            }))
          )}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke={COLORS.primary} name="Predicted Value" />
            <Line type="monotone" dataKey="confidence" stroke={COLORS.success} name="Confidence %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Health Forecast */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health Forecast</h3>
        {(() => {
          const forecast = predictiveAnalyzer.getHealthForecast();
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">Overall Health Forecast</span>
                <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                  forecast.overall === 'HEALTHY' ? 'bg-green-100 text-green-800' :
                  forecast.overall === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {forecast.overall}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Next 24 Hours</p>
                  <div className="space-y-1">
                    {forecast.next24Hours.map((warning, index) => (
                      <div key={index} className="text-sm text-gray-600">
                        • {warning.message}
                      </div>
                    ))}
                    {forecast.next24Hours.length === 0 && (
                      <p className="text-sm text-green-600">No issues predicted</p>
                    )}
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Next 7 Days</p>
                  <div className="space-y-1">
                    {forecast.next7Days.slice(0, 3).map((warning, index) => (
                      <div key={index} className="text-sm text-gray-600">
                        • {warning.message}
                      </div>
                    ))}
                    {forecast.next7Days.length > 3 && (
                      <p className="text-sm text-gray-500">...and {forecast.next7Days.length - 3} more</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );

  // Render Dependency Map section
  const renderDependencies = () => (
    <div className="space-y-6">
      {/* System Dependencies */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Dependencies</h3>
        <div className="space-y-4">
          {Object.entries(dependencyMapper.dependencyGraph).map(([systemName, system]) => (
            <div key={systemName} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{system.name}</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  system.type === 'infrastructure' ? 'bg-purple-100 text-purple-800' :
                  system.type === 'system' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {system.type}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(system.components || {}).map(([compName, component]) => (
                  <div key={compName} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{component.name}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        component.health >= 90 ? 'bg-green-500' :
                        component.health >= 70 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-600 mb-1">Health: {component.health}%</p>
                    <p className="text-xs text-gray-600">Criticality: {component.criticality}</p>
                    {component.dependencies && component.dependencies.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Depends on: {component.dependencies.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Paths */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Critical Paths</h3>
        <div className="space-y-3">
          {dependencyMapper.criticalPaths.map((path, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{path.name}</h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  path.criticality === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                  path.criticality === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {path.criticality}
                </span>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                {path.path.map((step, stepIndex) => (
                  <React.Fragment key={step}>
                    <span className="text-sm text-gray-600">{step}</span>
                    {stepIndex < path.path.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <p className="text-xs text-gray-500">
                Impact Score: {path.impact_score} | 
                Single Points of Failure: {path.single_point_of_failure.join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="enhanced-audit-dashboard p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Enhanced System Audit</h1>
              <p className="text-gray-600">AI-powered diagnostics and self-healing</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={runComprehensiveAudit}
              disabled={isRunning}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Running Analysis...</span>
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  <span>Run Comprehensive Audit</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* View Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
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
              className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeView === view.id
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <view.icon className="w-4 h-4" />
              <span>{view.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content based on active view */}
      {activeView === 'overview' && renderOverview()}
      {activeView === 'rca' && renderRCA()}
      {activeView === 'healing' && renderSelfHealing()}
      {activeView === 'predictive' && renderPredictive()}
      {activeView === 'dependencies' && renderDependencies()}
    </div>
  );
};

export default EnhancedAuditDashboard;
