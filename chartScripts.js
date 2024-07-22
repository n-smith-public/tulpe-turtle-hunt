// Helper function, see ./logging.js
async function logToServer(level, message) {
    try {
        const response = await fetch('/consoleMessage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ level, message }),
        });

        if (response.ok) {
            //console.log('Log message sent successfully');
        } else {
            console.error('Failed to send log message');
        }
    } catch (error) {
        console.error('Error sending log message:', error);
    }
}

let lineChartData = [];
let lodgeChart = null;
let pronounsChart = null;
let deviceChart = null;

const refreshCharts = () => {
    // Clear line chart data
    lineChartData = [];
    // Render all charts
    renderChart('line-chart');
    renderChart('lodge-chart');
    renderChart('pronouns-chart');
    renderChart('device-chart');
};

function getChartName(chartId) {
    switch (chartId) {
        case 'line-chart':
            return 'Line';
        case 'lodge-chart':
            return 'Lodge';
        case 'pronouns-chart':
            return 'Pronouns';
        case 'device-chart':
            return 'Device';
        default:
            return '';
    }
}

const fetchData = async (endpoint) => {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        //logToServer('info', `The fetchData() function has fetched the data from ${endpoint}.`);
        return data;
    } catch (error) {
        logToServer('error', `The fetchData() function failed to fetch the data from ${endpoint}. Error: `, error);
        //console.error(`Failed to fetch data from ${endpoint}:`, error);
        return [];
    }
};

const renderChart = async (chartId) => {
    let chartInstance = null;
    let endpoint = '';

    switch (chartId) {
        case 'line-chart':
            endpoint = '/query-people-count-by-date';
            break;
        case 'lodge-chart':
            endpoint = '/query-lodge-data';
            break;
        case 'pronouns-chart':
            endpoint = '/query-pronouns-data';
            break;
        case 'device-chart':
            endpoint = '/query-device-data';
            break;
        default:
            return;
    }

    const data = await fetchData(endpoint);
    if (data.length === 0) return;

    const ctx = document.getElementById(chartId).getContext('2d');
    let labels = [];
    let counts = [];

    switch (chartId) {
        case 'line-chart':
            lineChartData.push(...data);
            lineChartData.sort((a, b) => new Date(a.Date) - new Date(b.Date)); // Sort by Date
            
            labels = lineChartData.map(entry => entry.Date);
            counts = lineChartData.map(entry => entry.Count);

            break;
        case 'lodge-chart':
        case 'pronouns-chart':
        case 'device-chart':
            labels = data.map(entry => entry.Label || entry.Lodge || entry.Pronouns || entry['Device Data']);
            counts = data.map(entry => entry.Count);
            break;
        default:
            return;
    }

    // Check if there is only one label
    const uniqueLabels = new Set(labels);
    const isSingleType = uniqueLabels.size === 1;
    
    if (chartInstance) {
        chartInstance.data.labels = labels;
        chartInstance.data.datasets[0].data = counts;
        if (chartInstance.config.type !== 'pie') {
            chartInstance.options.plugins.legend.display = !isSingleType;
        }
        chartInstance.update();
    } else {
        chartInstance = new Chart(ctx, {
            type: chartId === 'line-chart' ? 'line' : 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 159, 64, 0.2)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: chartId !== 'line-chart' && !isSingleType, // Display legend for pie chart only if there are multiple types
                        position: 'top'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            if (context.parsed.y !== null) {
                                return label + new Date(context.raw.x).toLocaleDateString('en-GB') + ' - ' + context.parsed.y;
                            }
                            return '';
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'MMM d' // Adjusted display format for day
                            }
                        },
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                }
            }
        });
    }
    
};

const populateDataTable = async () => {
    const endpoint = '/query-all-user-data'; // Backend endpoint for fetching data
    const data = await fetchData(endpoint);

    if (data.length === 0) {
        logToConsole('error', 'When attempting to run the populateDataTable() function, there was no data found to populate it with.');
        //console.log('No data fetched.');
        return;
    }

    const tableBody = document.querySelector('.data-table tbody');
    tableBody.innerHTML = ''; // Clear existing table rows

    data.forEach(entry => {
        const row = document.createElement('tr');
        Object.values(entry).forEach(value => {
            const cell = document.createElement('td');
            cell.textContent = value;
            row.appendChild(cell);
        });
        tableBody.appendChild(row);
    });
};

// Function to initialize the side panel and data table
const initializeSidePanel = () => {
    populateDataTable(); // Populate the data table on load
};


// Function to initialize the charts
const initializeCharts = async () => {
    await renderChart('line-chart');
    await renderChart('lodge-chart');
    await renderChart('pronouns-chart');
    await renderChart('device-chart');
};

document.addEventListener('DOMContentLoaded', () => {
    initializeCharts();
    initializeSidePanel();

    document.getElementById('refresh-button').addEventListener('click', refreshCharts);
});
