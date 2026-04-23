import React, { useState } from 'react';
import { Download, FileText, Share2, Calendar, Clock, TrendingUp, AlertTriangle, CheckCircle, XCircle, BarChart3, PieChart, Activity, Target, Layers, GitBranch, Package, Code, Database, Shield, Users, MessageSquare } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import './AuditReportGenerator.css';

const AuditReportGenerator = ({ auditData, onExport, onShare }) => {
  const [reportType, setReportType] = useState('detailed');
  const [selectedTimeRange, setSelectedTimeRange] = useState('current');

  // Color scheme for charts
  const COLORS = {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    primary: '#2563eb'
  };

  // Generate summary statistics
  const generateSummaryStats = () => {
    if (!auditData?.results) return [];

    const categories = Object.entries(auditData.results).map(([key, result]) => ({
      name: result.category,
      score: result.summary.score,
      status: result.summary.overallStatus,
      tests: result.summary.total,
      passed: result.summary.pass,
      failed: result.summary.fail,
      warnings: result.summary.warn
    }));

    return categories;
  };

  // Generate performance data
  const generatePerformanceData = () => {
    if (!auditData?.results) return [];

    return Object.entries(auditData.results).map(([key, result]) => {
      const avgTime = result.tests.reduce((acc, test) => {
        return acc + (test.executionTime || 0);
      }, 0) / result.tests.length;

      return {
        category: result.category,
        avgResponseTime: Math.round(avgTime),
        totalTests: result.tests.length,
        successRate: result.summary.score
      };
    });
  };

  // Generate status distribution
  const generateStatusDistribution = () => {
    if (!auditData?.results) return [];

    const distribution = {
      pass: 0,
      fail: 0,
      warn: 0,
      skip: 0
    };

    Object.values(auditData.results).forEach(result => {
      result.tests.forEach(test => {
        distribution[test.status] = (distribution[test.status] || 0) + 1;
      });
    });

    return Object.entries(distribution).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1),
      value: count,
      color: status === 'pass' ? COLORS.success : status === 'fail' ? COLORS.error : status === 'warn' ? COLORS.warning : COLORS.info
    }));
  };

  // Generate radar data for feature coverage
  const generateRadarData = () => {
    if (!auditData?.results) return [];

    return Object.entries(auditData.results).map(([key, result]) => ({
      feature: result.category,
      coverage: result.summary.score,
      reliability: result.summary.pass > 0 ? (result.summary.pass / result.summary.total) * 100 : 0,
      performance: 100 - (result.tests.reduce((acc, test) => acc + (test.executionTime || 0), 0) / result.tests.length / 10) // Normalize to 0-100
    }));
  };

  // Generate trend data (mock data for demonstration)
  const generateTrendData = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dates.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: Math.floor(Math.random() * 20) + 75, // Mock scores between 75-95
        issues: Math.floor(Math.random() * 5) + 1
      });
    }
    return dates;
  };

  const summaryStats = generateSummaryStats();
  const performanceData = generatePerformanceData();
  const statusDistribution = generateStatusDistribution();
  const radarData = generateRadarData();
  const trendData = generateTrendData();

  // Export functions
  const exportToJSON = () => {
    const dataStr = JSON.stringify(auditData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `audit-report-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportToCSV = () => {
    let csv = 'Category,Test,Status,Message,Execution Time\n';
    Object.entries(auditData.results).forEach(([key, result]) => {
      result.tests.forEach(test => {
        csv += `"${result.category}","${test.name}","${test.status}","${test.message}","${test.executionTime || 0}"\n`;
      });
    });
    const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const exportFileDefaultName = `audit-report-${new Date().toISOString().split('T')[0]}.csv`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const generatePDFReport = () => {
    const printWindow = window.open('', '_blank');
    const htmlContent = generatePrintableHTML();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const generatePrintableHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Audit Report - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .section { margin: 20px 0; }
          .metric { display: inline-block; margin: 10px; padding: 10px; border: 1px solid #ddd; }
          .pass { color: green; }
          .fail { color: red; }
          .warn { color: orange; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>System Audit Report</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <p>Overall Score: ${auditData.metrics?.overallScore || 0}%</p>
        </div>
        <div class="section">
          <h2>Summary</h2>
          <div class="metric">Total Tests: ${auditData.metrics?.totalTests || 0}</div>
          <div class="metric pass">Passed: ${auditData.metrics?.passedTests || 0}</div>
          <div class="metric fail">Failed: ${auditData.metrics?.failedTests || 0}</div>
          <div class="metric warn">Warnings: ${auditData.metrics?.warningTests || 0}</div>
        </div>
        <div class="section">
          <h2>Detailed Results</h2>
          <table>
            <tr>
              <th>Category</th>
              <th>Test</th>
              <th>Status</th>
              <th>Message</th>
              <th>Time (ms)</th>
            </tr>
            ${Object.entries(auditData.results).map(([key, result]) => 
              result.tests.map(test => `
                <tr>
                  <td>${result.category}</td>
                  <td>${test.name}</td>
                  <td class="${test.status}">${test.status.toUpperCase()}</td>
                  <td>${test.message}</td>
                  <td>${test.executionTime || 0}</td>
                </tr>
              `).join('')
            ).join('')}
          </table>
        </div>
      </body>
      </html>
    `;
  };

  return (
    <div className="audit-report-root">
      {/* Header */}
      <header className="report-header">
        <div className="header-top">
          <div className="title-section">
            <div className="title-icon-box">
              <FileText size={32} />
            </div>
            <div>
              <h1>Audit Report Generator</h1>
              <p>Comprehensive system analysis and reporting</p>
            </div>
          </div>
          
          <div className="header-actions">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="report-select"
            >
              <option value="summary">Summary Report</option>
              <option value="detailed">Detailed Report</option>
              <option value="executive">Executive Report</option>
              <option value="technical">Technical Report</option>
            </select>
            
            <div className="export-group">
              <button onClick={exportToJSON} className="btn-export json">
                <Download size={14} /> JSON
              </button>
              <button onClick={exportToCSV} className="btn-export csv">
                <Download size={14} /> CSV
              </button>
              <button onClick={generatePDFReport} className="btn-export pdf">
                <FileText size={14} /> PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Key Metrics */}
      <div className="stats-grid">
        <div className="stat-card-mini">
          <div className="stat-icon blue">
            <Target size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Overall Score</span>
            <div className="value">{auditData.metrics?.overallScore || 0}%</div>
          </div>
        </div>
        
        <div className="stat-card-mini">
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Tests Passed</span>
            <div className="value">{auditData.metrics?.passedTests || 0}</div>
          </div>
        </div>
        
        <div className="stat-card-mini">
          <div className="stat-icon red">
            <XCircle size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Tests Failed</span>
            <div className="value">{auditData.metrics?.failedTests || 0}</div>
          </div>
        </div>
        
        <div className="stat-card-mini">
          <div className="stat-icon yellow">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <span className="label">Duration</span>
            <div className="value">{auditData.metrics?.totalDuration || 0}ms</div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        <div className="chart-box">
          <h3>Performance by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summaryStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} />
              <Legend />
              <Bar dataKey="score" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Score %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>Feature Coverage Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="feature" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar name="Coverage" dataKey="coverage" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.6} />
              <Radar name="Reliability" dataKey="reliability" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-box">
          <h3>Response Time Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgResponseTime" stroke={COLORS.warning} strokeWidth={3} dot={{r: 4}} name="Avg Response (ms)" />
              <Line type="monotone" dataKey="successRate" stroke={COLORS.success} strokeWidth={3} dot={{r: 4}} name="Success Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Results Table */}
      <div className="results-table-container">
        <h3>Detailed Test Results</h3>
        <div className="table-wrapper">
          <table className="results-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Test Name</th>
                <th>Status</th>
                <th>Message</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(auditData.results || {}).map(([key, result]) =>
                result.tests.map((test, index) => (
                  <tr key={`${key}-${index}`}>
                    <td><strong>{result.category}</strong></td>
                    <td>{test.name}</td>
                    <td>
                      <span className={`status-tag ${test.status}`}>
                        {test.status}
                      </span>
                    </td>
                    <td>{test.message}</td>
                    <td>{test.executionTime || 0}ms</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Issues & Recommendations */}
      <div className="insights-grid">
        <div className="insight-card">
          <h3>
            <AlertTriangle color="#ef4444" size={20} />
            Critical Issues
          </h3>
          <div className="issues-list">
            {Object.entries(auditData.results || {}).map(([key, result]) =>
              result.tests
                .filter(test => test.status === 'fail')
                .map((test, index) => (
                  <div key={`${key}-${index}`} className="issue-item">
                    <strong>{test.name}</strong>
                    <p style={{ margin: '4px 0', fontSize: '13px', opacity: 0.8 }}>{test.message}</p>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444' }}>CATEGORY: {result.category}</span>
                  </div>
                ))
            )}
            {Object.values(auditData.results || {}).every(result => 
              result.tests.every(test => test.status !== 'fail')
            ) && (
              <p style={{ textAlign: 'center', opacity: 0.5, padding: '20px' }}>No critical issues found 🎉</p>
            )}
          </div>
        </div>

        <div className="insight-card">
          <h3>
            <TrendingUp color="#2563eb" size={20} />
            Recommendations
          </h3>
          <div className="recs-list">
            <div className="rec-item">
              <strong>Optimize Database Queries</strong>
              <p style={{ margin: '4px 0', fontSize: '13px', opacity: 0.8 }}>Some queries are taking longer than expected</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', fontWeight: 700 }}>
                <span style={{ color: '#2563eb' }}>PRIORITY: MEDIUM</span>
                <span style={{ color: '#666' }}>TIME: 2H</span>
              </div>
            </div>
            
            <div className="rec-item" style={{ borderLeftColor: '#f59e0b' }}>
              <strong>Review RLS Policies</strong>
              <p style={{ margin: '4px 0', fontSize: '13px', opacity: 0.8 }}>Some Row Level Security policies may need updates</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px', fontWeight: 700 }}>
                <span style={{ color: '#f59e0b' }}>PRIORITY: HIGH</span>
                <span style={{ color: '#666' }}>TIME: 4H</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditReportGenerator;

