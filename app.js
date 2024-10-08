// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyAe6SkpJy6s6qO5ksfLmmAkpVy1xTuYVys",
    authDomain: "income-expense-4517e.firebaseapp.com",
    databaseURL: "https://income-expense-4517e-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "income-expense-4517e",
    storageBucket: "income-expense-4517e.appspot.com",
    messagingSenderId: "116509432200",
    appId: "1:116509432200:web:b768a68cae9a780682023d",
    measurementId: "G-529FLQH7PP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// DOM Elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const dataForm = document.getElementById('data-form');
const currentDateSpan = document.getElementById('current-date');
const incomeTable = document.getElementById('income-table').getElementsByTagName('tbody')[0];
const expenseTable = document.getElementById('expense-table').getElementsByTagName('tbody')[0];
const totalIncomeSpan = document.getElementById('total-income');
const totalExpenseSpan = document.getElementById('total-expense');
const totalAmountSpan = document.getElementById('total-amount');
const summaryTable = document.getElementById('summary-table').getElementsByTagName('tbody')[0];
const goToPresentBtn = document.getElementById('go-to-present');
const startDatePicker = document.getElementById('start-date');
const endDatePicker = document.getElementById('end-date');
const filterBtn = document.getElementById('filter-btn');

// Variables for sorting
let sortDirection = 'asc';
let sortedData = [];

// Helper function to format date for storage (YYYY-MM-DD)
function formatDateForStorage(date) {
    return date.toISOString().split('T')[0];
}

// Helper function to format date for display (Month Day, Year)
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    return date.toLocaleDateString('en-US', options);
}

// Helper function to safely get a number value
function safeNumber(value) {
    return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
}

// Set current date
let currentDate = new Date();
updateCurrentDate();

function updateCurrentDate() {
    currentDateSpan.textContent = formatDateForDisplay(currentDate);
    updateGoToPresentButton();

    // Dispatch a custom event when the date changes
    const event = new CustomEvent('dateChanged', { detail: { date: currentDate } });
    document.dispatchEvent(event);
}

function updateGoToPresentButton() {
    const today = new Date();
    if (currentDate.toDateString() === today.toDateString()) {
        goToPresentBtn.style.display = 'none';
    } else {
        goToPresentBtn.style.display = 'block';
    }
}

// Tab switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tabContent = document.getElementById(`${btn.dataset.tab}-tab`);
        tabContent.classList.add('active');
        if (btn.dataset.tab === 'view') {
            loadSummaryData();
        }
        adjustGrandTotalPosition();
        localStorage.setItem('activeTab', btn.dataset.tab);
    });
});

// Calculate expense
function calculateExpense() {
    const amount = safeNumber(dataForm.amount.value);
    const change = safeNumber(dataForm.change.value);
    dataForm.expense.value = (amount - change).toFixed(2);
}

dataForm.amount.addEventListener('input', calculateExpense);
dataForm.change.addEventListener('input', calculateExpense);

// Submit form
dataForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.dataset.editId) {
        // If editId exists, this is an update operation, prevent double submission
        return;
    }

    // Check if at least one input field has data
    const incomeFields = ['income', 'or-number-income', 'customer', 'job'];
    const expenseFields = ['technician', 'or-number-expense', 'amount', 'change'];
    const incomeHasData = incomeFields.some(field => dataForm[field].value.trim() !== '');
    const expenseHasData = expenseFields.some(field => dataForm[field].value.trim() !== '');
    if (!incomeHasData && !expenseHasData) {
        alert('Please fill in at least one field.');
        return;
    }
    
    const formData = {
        date: formatDateForStorage(currentDate),
        type: dataForm.income.value ? 'Income' : 'Expense',
        orNumber: dataForm.income.value ? dataForm['or-number-income'].value : dataForm['or-number-expense'].value,
        customerTechnician: dataForm.income.value ? dataForm.customer.value : dataForm.technician.value,
        description: dataForm.description ? dataForm.description.value : '',
        jobExpense: dataForm.income.value ? dataForm.job.value : dataForm.expense.value,
        amount: safeNumber(dataForm.income.value || dataForm.amount.value),
        change: safeNumber(dataForm.change.value),
        expense: safeNumber(dataForm.expense.value),
        receiptReceived: dataForm.receipt.checked,
        technician: dataForm.income.value ? dataForm['technician-income'].value : ''
    };
    
    try {
        await db.collection('transactions').add(formData);
        alert('Data submitted successfully!');
        loadDateData(currentDate);
        dataForm.reset();
    } catch (error) {
        console.error('Error adding document: ', error);
        alert('Error submitting data. Please try again.');
    }
});

// Load data for a specific date
async function loadDateData(date) {
    try {
        const formattedDate = formatDateForStorage(date);
        const snapshot = await db.collection('transactions').where('date', '==', formattedDate).get();
        const data = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
        
        incomeTable.innerHTML = '';
        expenseTable.innerHTML = '';
        
        let totalIncome = 0;
        let totalExpense = 0;
        
        data.forEach(item => {
            if (item.type === 'Income') {
                const row = incomeTable.insertRow();
                row.innerHTML = `
                    <td>${item.orNumber || ''}</td>
                    <td>${item.customerTechnician || ''}</td>
                    <td>${item.jobExpense || ''}</td>
                    <td>${item.technician || ''}</td>
                    <td>${safeNumber(item.amount).toFixed(2)}</td>
                    <td>
                        <button class="edit-btn" data-id="${item.id}">Edit</button>
                        <button class="delete-btn" data-id="${item.id}">Delete</button>
                    </td>
                `;
                totalIncome += safeNumber(item.amount);
                
                // Add event listeners for edit and delete buttons
                row.querySelector('.edit-btn').addEventListener('click', () => editEntry(item.id));
                row.querySelector('.delete-btn').addEventListener('click', () => deleteEntry(item.id));
            } else {
                const row = expenseTable.insertRow();
                row.innerHTML = `
                    <td>${item.orNumber || ''}</td>
                    <td>${item.customerTechnician || ''}</td>
                    <td>${item.description || ''}</td>
                    <td>${safeNumber(item.amount).toFixed(2)}</td>
                    <td>${safeNumber(item.change).toFixed(2)}</td>
                    <td>${safeNumber(item.expense).toFixed(2)}</td>
                    <td>${item.receiptReceived ? 'Yes' : 'No'}</td>
                    <td>
                        <button class="edit-btn" data-id="${item.id}">Edit</button>
                        <button class="delete-btn" data-id="${item.id}">Delete</button>
                    </td>
                `;
                totalExpense += safeNumber(item.expense);
                
                // Add event listeners for edit and delete buttons
                row.querySelector('.edit-btn').addEventListener('click', () => editEntry(item.id));
                row.querySelector('.delete-btn').addEventListener('click', () => deleteEntry(item.id));
            }
        });
        
        totalIncomeSpan.textContent = totalIncome.toFixed(2);
        totalExpenseSpan.textContent = totalExpense.toFixed(2);
        totalAmountSpan.textContent = (totalIncome - totalExpense).toFixed(2);
    } catch (error) {
        console.error('Error loading date data: ', error);
        alert('Error loading data. Please try again.');
    }
}

// Edit entry
async function editEntry(id) {
    try {
        const doc = await db.collection('transactions').doc(id).get();
        const data = doc.data();

        if (data.type === 'Income') {
            dataForm.income.value = safeNumber(data.amount);
            dataForm['or-number-income'].value = data.orNumber || '';
            dataForm.customer.value = data.customerTechnician || '';
            dataForm.job.value = data.jobExpense || '';
            dataForm['technician-income'].value = data.technician || '';
        } else {
            dataForm.amount.value = safeNumber(data.amount);
            dataForm.change.value = safeNumber(data.change);
            dataForm.expense.value = safeNumber(data.expense);
            dataForm['or-number-expense'].value = data.orNumber || '';
            dataForm.technician.value = data.customerTechnician || '';
            dataForm.description.value = data.description || '';
        }
        dataForm.receipt.checked = data.receiptReceived || false;

        // Change submit button to update
        const submitBtn = dataForm.querySelector('button[type="submit"]');
        submitBtn.textContent = 'Update';
        submitBtn.dataset.editId = id;

        // Switch event listeners
        dataForm.removeEventListener('submit', submitFormHandler);
        dataForm.addEventListener('submit', updateFormHandler);
    } catch (error) {
        console.error('Error loading entry for edit: ', error);
        alert('Error loading entry for edit. Please try again.');
    }
}

// Update form handler
async function updateFormHandler(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const id = submitBtn.dataset.editId;

    if (!id) {
        // If no editId, fallback to submitting
        submitFormHandler(e);
        return;
    }

    const formData = {
        date: formatDateForStorage(currentDate),
        type: dataForm.income.value ? 'Income' : 'Expense',
        orNumber: dataForm.income.value ? dataForm['or-number-income'].value : dataForm['or-number-expense'].value,
        customerTechnician: dataForm.income.value ? dataForm.customer.value : dataForm.technician.value,
        description: dataForm.description ? dataForm.description.value : '',
        jobExpense: dataForm.income.value ? dataForm.job.value : dataForm.expense.value,
        amount: safeNumber(dataForm.income.value || dataForm.amount.value),
        change: safeNumber(dataForm.change.value),
        expense: safeNumber(dataForm.expense.value),
        receiptReceived: dataForm.receipt.checked,
        technician: dataForm.income.value ? dataForm['technician-income'].value : ''
    };

    try {
        await db.collection('transactions').doc(id).update(formData);
        alert('Data updated successfully!');
        loadDateData(currentDate);
        dataForm.reset();

        // Change update button back to submit
        submitBtn.textContent = 'Submit';
        delete submitBtn.dataset.editId;

        // Remove update event listener and add submit event listener
        dataForm.removeEventListener('submit', updateFormHandler);
        dataForm.addEventListener('submit', submitFormHandler);
    } catch (error) {
        console.error('Error updating document: ', error);
        alert('Error updating data. Please try again.');
    }
}

// Delete entry
async function deleteEntry(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        try {
            await db.collection('transactions').doc(id).delete();
            alert('Entry deleted successfully!');
            loadDateData(currentDate);
        } catch (error) {
            console.error('Error deleting document: ', error);
            alert('Error deleting entry. Please try again.');
        }
    }
}

// PDF export function for daily transactions
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Get the date of the income and expense data
    const dataDate = formatDateForDisplay(currentDate);

    const customHeader = `Income and Expense (${dataDate})`;
    const customFooter = "MI&I REFRIGERATION AND AIRCONDITIONING SERVICES";

    function addHeaderFooter(data) {
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text(customHeader, data.settings.margin.left, 10);
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(10);
        doc.text(customFooter, data.settings.margin.left, pageHeight - 10);
    }

    const incomeHeaders = ['OR Number', 'Customer', 'Job Done', 'Technician', 'Income'];
    const expenseHeaders = ['OR Number', 'Technician', 'Description', 'Amount', 'Change', 'Expense', 'Receipt Received'];

    const incomeRows = Array.from(incomeTable.rows).map(row => 
        Array.from(row.cells).slice(0, -1).map(cell => cell.textContent)
    );

    const expenseRows = Array.from(expenseTable.rows).map(row => 
        Array.from(row.cells).slice(0, -1).map(cell => cell.textContent)
    );

    const receiptRows = [
        ...incomeRows.map(row => [row[0], 'Income', 'N/A']),
        ...expenseRows.map(row => [row[0], 'Expense', row[5]])
    ];

    const totalIncome = totalInc

omeSpan.textContent;
    const totalExpense = totalExpenseSpan.textContent;
    const totalAmount = totalAmountSpan.textContent;

    // Income Table
    doc.setFontSize(12);
    doc.text('Income', 14, 20);
    doc.autoTable({
        head: [incomeHeaders],
        body: incomeRows,
        startY: 25,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
        didDrawPage: addHeaderFooter
    });

    // Expense Table
    doc.setFontSize(12);
    doc.text('Expense', 14, doc.lastAutoTable.finalY + 10);
    doc.autoTable({
        head: [expenseHeaders],
        body: expenseRows,
        startY: doc.lastAutoTable.finalY + 15,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
        didDrawPage: addHeaderFooter
    });

    // Totals
    doc.setFontSize(10);
    doc.text(`Total Income: ${totalIncome}`, 14, doc.lastAutoTable.finalY + 10);
    doc.text(`Total Expense: ${totalExpense}`, 14, doc.lastAutoTable.finalY + 15);
    doc.text(`Total Amount: ${totalAmount}`, 14, doc.lastAutoTable.finalY + 20);

    // Save the PDF
    const fileName = `INCOME&EXPENSE(${dataDate}).pdf`;
    doc.save(fileName);
}

// Add event listener for PDF export button
document.getElementById('export-pdf').addEventListener('click', exportPDF);

// Load summary data for view tab
async function loadSummaryData(startDate = null, endDate = null) {
    try {
        let query = db.collection('transactions');
        
        if (startDate && endDate) {
            query = query.where('date', '>=', startDate).where('date', '<=', endDate);
        }
        
        const snapshot = await query.get();
        const data = snapshot.docs.map(doc => doc.data());
        
        // Group data by date
        const groupedData = data.reduce((acc, curr) => {
            if (!acc[curr.date]) {
                acc[curr.date] = { totalIncome: 0, totalExpense: 0 };
            }
            if (curr.type === 'Income') {
                acc[curr.date].totalIncome += safeNumber(curr.amount);
            } else {
                acc[curr.date].totalExpense += safeNumber(curr.expense);
            }
            return acc;
        }, {});
        
        // Convert grouped data to array for sorting
        sortedData = Object.entries(groupedData).map(([date, totals]) => ({
            date,
            totalIncome: totals.totalIncome,
            totalExpense: totals.totalExpense,
            totalAmount: totals.totalIncome - totals.totalExpense
        }));

        // Initial sort
        sortDataByDate();
        
        // Display data in summary table
        displaySummaryData();
    } catch (error) {
        console.error('Error loading summary data: ', error);
        alert('Error loading summary data. Please try again.');
    }
}

// Sort data by date
function sortDataByDate() {
    sortedData.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });
}

// Display sorted summary data
function displaySummaryData() {
    const summaryTableBody = document.querySelector('#summary-table tbody');
    summaryTableBody.innerHTML = '';
    let grandTotalIncome = 0;
    let grandTotalExpense = 0;
    
    sortedData.forEach(({ date, totalIncome, totalExpense, totalAmount }) => {
        const row = summaryTableBody.insertRow();
        row.innerHTML = `
            <td>${formatDateForDisplay(date)}</td>
            <td>${totalIncome.toFixed(2)}</td>
            <td>${totalExpense.toFixed(2)}</td>
            <td>${totalAmount.toFixed(2)}</td>
        `;
        row.addEventListener('click', () => {
            currentDate = new Date(date);
            updateCurrentDate();
            loadDateData(currentDate);
            document.querySelector('.tab-btn[data-tab="input"]').click();
        });
        
        grandTotalIncome += totalIncome;
        grandTotalExpense += totalExpense;
    });
    
    // Update grand totals
    const grandTotalAmount = grandTotalIncome - grandTotalExpense;
    document.getElementById('grand-total-income').textContent = grandTotalIncome.toFixed(2);
    document.getElementById('grand-total-expense').textContent = grandTotalExpense.toFixed(2);
    document.getElementById('grand-total-amount').textContent = grandTotalAmount.toFixed(2);

    // Adjust the position of the grand total sticky element
    adjustGrandTotalPosition();
}

// Toggle sort direction
function toggleSortDirection() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    sortDataByDate();
    displaySummaryData();
    updateSortIcon();
}

// Update sort icon
function updateSortIcon() {
    const dateHeader = document.querySelector('#summary-table th:first-child');
    dateHeader.innerHTML = `Date ${sortDirection === 'asc' ? '▲' : '▼'}`;
}

// Export view data to PDF
function exportViewPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    const dateRange = startDate && endDate 
        ? `(${formatDateForDisplay(startDate)} - ${formatDateForDisplay(endDate)})`
        : '(All Time)';

    const customHeader = `Income and Expense ${dateRange}`;
    const customFooter = "MI&I REFRIGERATION AND AIRCONDITIONING SERVICES";

    function addHeaderFooter(data) {
        doc.setFontSize(14);
        doc.setTextColor(40);
        doc.text(customHeader, data.settings.margin.left, 10);
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        doc.setFontSize(10);
        doc.text(customFooter, pageWidth - data.settings.margin.right - doc.getTextWidth(customFooter), pageHeight - 10);
    }

    const headers = ['Date', 'Total Income', 'Total Expense', 'Total Amount'];
    const rows = Array.from(document.querySelectorAll('#summary-table tbody tr')).map(row => 
        Array.from(row.cells).map(cell => cell.textContent)
    );

    const grandTotalRow = [
        { content: 'Grand Total', styles: { fontStyle: 'bold' } },
        { content: document.getElementById('grand-total-income').textContent, styles: { fontStyle: 'bold' } },
        { content: document.getElementById('grand-total-expense').textContent, styles: { fontStyle: 'bold' } },
        { content: document.getElementById('grand-total-amount').textContent, styles: { fontStyle: 'bold' } }
    ];

    doc.autoTable({
        head: [headers],
        body: [...rows, grandTotalRow],
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255] },
        didDrawPage: addHeaderFooter
    });

    // Save the PDF
    const fileName = `INCOME&EXPENSE_SUMMARY${dateRange.replace(/[()]/g, '')}.pdf`;
    doc.save(fileName);
}

// Add event listener for view PDF export button
document.getElementById('export-view-pdf').addEventListener('click', async () => {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    // Reload the summary data if date range is set
    if (startDate && endDate) {
        await loadSummaryData(startDate, endDate);
    }
    
    exportViewPDF();
});

// Adjust grand total position
function adjustGrandTotalPosition() {
    const grandTotalSticky = document.getElementById('grand-total-sticky');
    const summaryTableContainer = document.querySelector('.summary-table-container');
    const viewTab = document.getElementById('view-tab');

    if (viewTab.classList.contains('active')) {
        grandTotalSticky.style.display = 'block';
        summaryTableContainer.style.paddingBottom = `${grandTotalSticky.offsetHeight}px`;
    } else {
        grandTotalSticky.style.display = 'none';
        summaryTableContainer.style.paddingBottom = '0';
    }
}

// Add a window resize event listener to adjust the grand total position
window.addEventListener('resize', adjustGrandTotalPosition);

// Go to present date button
goToPresentBtn.addEventListener('click', () => {
    currentDate = new Date();
    updateCurrentDate();
    loadDateData(currentDate);
});

// Filter button event listener
filterBtn.addEventListener('click', () => {
    const startDate = startDatePicker.value;
    const endDate = endDatePicker.value;
    if (startDate && endDate) {
        loadSummaryData(startDate, endDate);
    } else {
        alert('Please select both start and end dates.');
    }
});

// Submit form handler
function submitFormHandler(e) {
    e.preventDefault();
    // ... (same as the submit form code above)
}

// Add submit event listener
dataForm.addEventListener('submit', submitFormHandler);

// Notepad functionality
document.addEventListener('DOMContentLoaded', function() {
    const notepadTextarea = document.getElementById('notepad');
    const notepadDateSpan = document.getElementById('notepad-date');

    // Function to format date as YYYY-MM-DD
    function formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    // Load saved notes from Firebase for a specific date
    async function loadNotes(date) {
        const formattedDate = formatDate(date);
        try {
            const doc = await db.collection('notepad').doc(formattedDate).get();
            if (doc.exists) {
                notepadTextarea.value = doc.data().content;
            } else {
                notepadTextarea.value = ''; // Clear the textarea if no notes for this date
            }
            updateNotepadDate(date);
        } catch (error) {
            console.error('Error loading notes:', error);
        }
    }

    // Save notes to Firebase for a specific date
    async function saveNotes(date) {
        const formattedDate = formatDate(date);
        try {
            await db.collection('notepad').doc(formattedDate).set({
                content: notepadTextarea.value,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('Error saving notes:', error);
        }
    }

    // Update the displayed date for the notepad
    function updateNotepadDate(date) {
        notepadDateSpan.textContent = date.toLocaleDateString();
    }

    // Event listener for date changes in the income and expense tracker
    document.addEventListener('dateChanged', function(e) {
        const newDate = e.detail.date;
        loadNotes(newDate);
    });

    // Save notes when the textarea content changes
    notepadTextarea.addEventListener('input', function() {
        saveNotes(currentDate);
    });

    // Initial load of notes for the current date
    loadNotes(currentDate);
});

// Modify the HTML for the summary table header
document.addEventListener('DOMContentLoaded', function() {
    const summaryTableHeader = document.querySelector('#summary-table thead tr');
    summaryTableHeader.innerHTML = `
        <th style="cursor: pointer;">Date</th>
        <th>Total Income</th>
        <th>Total Expense</th>
        <th>Total Amount</th>
    `;
    
    // Add click event listener to the Date header
    const dateHeader = document.querySelector('#summary-table th:first-child');
    dateHeader.addEventListener('click', toggleSortDirection);
    
    // Initial update of sort icon
    updateSortIcon();
});

// Initial data load
loadDateData(currentDate);
loadSummaryData();
adjustGrandTotalPosition();

// To keep the system on the same page when refreshing, add this code at the end of the file
window.onload = function() {
    const selectedSystem = localStorage.getItem('selectedSystem');
    if (selectedSystem === 'income-expense-tracker') {
        document.querySelector('.container').style.display = 'none';
        document.getElementById('income-expense-tracker').style.display = 'block';
    }

    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
        document.querySelector(`.tab-btn[data-tab="${activeTab}"]`).click();
    }
    adjustGrandTotalPosition();
};