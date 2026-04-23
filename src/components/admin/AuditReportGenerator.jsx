import React, { useState } from 'react';
import { Download, FileText, Share2, Calendar, Clock, TrendingUp, AlertTriangle, CheckCircle, XCircle, BarChart3, PieChart, Activity, Target, Layers, GitBranch, Package, Code, Database, Shield, Users, MessageSquare } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const AuditReportGenerator = ({ auditData, onExport, onShare }) => {
  const [reportType, setReportType] = useState('detailed');
  const [selectedTimeRange, setSelectedTimeRange] = useState('current');

  // Color scheme for charts
  const COLORS = {
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    primary: '#6366f1'
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
    // This would require a PDF library like jsPDF
    // For now, we'll create a printable HTML version
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
    <div className="audit-report-generator p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <FileText className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Report Generator</h1>
              <p className="text-gray-600">Comprehensive system analysis and reporting</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="summary">Summary Report</option>
              <option value="detailed">Detailed Report</option>
              <option value="executive">Executive Report</option>
              <option value="technical">Technical Report</option>
            </select>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={exportToJSON}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>JSON</span>
              </button>
              
              <button
                onClick={exportToCSV}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </button>
              
              <button
                onClick={generatePDFReport}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                <span>PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Overall Score</p>
              <p className="text-2xl font-bold text-gray-900">{auditData.metrics?.overallScore || 0}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Tests Passed</p>
              <p className="text-2xl font-bold text-gray-900">{auditData.metrics?.passedTests || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Tests Failed</p>
              <p className="text-2xl font-bold text-gray-900">{auditData.metrics?.failedTests || 0}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Duration</p>
              <p className="text-2xl font-bold text-gray-900">{auditData.metrics?.totalDuration || 0}ms</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Performance by Category */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance by Category</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={summaryStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" fill={COLORS.primary} name="Score %" />
              <Bar dataKey="passed" fill={COLORS.success} name="Passed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RePieChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Coverage Radar */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Feature Coverage Analysis</h3>
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

        {/* Response Time Trend */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Time Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="avgResponseTime" stroke={COLORS.warning} name="Avg Response (ms)" />
              <Line type="monotone" dataKey="successRate" stroke={COLORS.success} name="Success Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Results Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Test Results</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3">Test Name</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Message</th>
                <th className="px-6 py-3">Response Time</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(auditData.results || {}).map(([key, result]) =>
                result.tests.map((test, index) => (
                  <tr key={`${key}-${index}`} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{result.category}</td>
                    <td className="px-6 py-4">{test.name}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        test.status === 'pass' ? 'bg-green-100 text-green-800' :
                        test.status === 'fail' ? 'bg-red-100 text-red-800' :
                        test.status === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {test.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">{test.message}</td>
                    <td className="px-6 py-4">{test.executionTime || 0}ms</td>
                    <td className="px-6 py-4">
                      <button className="text-blue-600 hover:text-blue-800 text-sm">View Details</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Issues & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Critical Issues */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            Critical Issues
          </h3>
          <div className="space-y-3">
            {Object.entries(auditData.results || {}).map(([key, result]) =>
              result.tests
                .filter(test => test.status === 'fail')
                .map((test, index) => (
                  <div key={`${key}-${index}`} className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-red-900">{test.name}</h4>
                        <p className="text-sm text-red-700 mt-1">{test.message}</p>
                        <p className="text-xs text-red-600 mt-2">Category: {result.category}</p>
                      </div>
                    </div>
                  </div>
                ))
            )}
            {Object.values(auditData.results || {}).every(result => 
              result.tests.every(test => test.status !== 'fail')
            ) && (
              <p className="text-green-600 text-center py-4">No critical issues found 🎉</p>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 text-blue-600 mr-2" />
            Recommendations
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Optimize Database Queries</h4>
                  <p className="text-sm text-blue-700 mt-1">Some queries are taking longer than expected</p>
                  <p className="text-xs text-blue-600 mt-2">Priority: Medium | Est. Time: 2 hours</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-yellow-900">Review RLS Policies</h4>
                  <p className="text-sm text-yellow-700 mt-1">Some Row Level Security policies may need updates</p>
                  <p className="text-xs text-yellow-600 mt-2">Priority: High | Est. Time: 4 hours</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">System Performance Good</h4>
                  <p className="text-sm text-green-700 mt-1">Overall system performance is within acceptable limits</p>
                  <p className="text-xs text-green-600 mt-2">Priority: Low | Est. Time: 1 hour</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditReportGenerator;
