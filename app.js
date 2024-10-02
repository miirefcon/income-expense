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

// Helper function to format date for storage (YYYY-MM-DD)
function formatDateForStorage(date) {
    return date.toISOString().split('T')[0];
}

// Helper function to format date for display (Month Day, Year)
function formatDateForDisplay(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
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
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        if (btn.dataset.tab === 'view') {
            loadSummaryData();
        }
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
        jobExpense: dataForm.income.value ? dataForm.job.value : dataForm.expense.value,
        amount: safeNumber(dataForm.income.value || dataForm.amount.value),
        change: safeNumber(dataForm.change.value),
        expense: safeNumber(dataForm.expense.value),
        receiptReceived: dataForm.receipt.checked
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
        } else {
            dataForm.amount.value = safeNumber(data.amount);
            dataForm.change.value = safeNumber(data.change);
            dataForm.expense.value = safeNumber(data.expense);
            dataForm['or-number-expense'].value = data.orNumber || '';
            dataForm.technician.value = data.customerTechnician || '';
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
        jobExpense: dataForm.income.value ? dataForm.job.value : dataForm.expense.value,
        amount: safeNumber(dataForm.income.value || dataForm.amount.value),
        change: safeNumber(dataForm.change.value),
        expense: safeNumber(dataForm.expense.value),
        receiptReceived: dataForm.receipt.checked
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

// PDF export function
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

    const incomeHeaders = ['OR Number', 'Customer', 'Job Done', 'Income'];
    const expenseHeaders = ['OR Number', 'Technician', 'Amount', 'Change', 'Expense', 'Receipt Received'];
    const receiptHeaders = ['OR Number', 'Type', 'Receipt Received'];

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

    const totalIncome = totalIncomeSpan.textContent;
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
        
        // Display data in summary table
        summaryTable.innerHTML = '';
        Object.entries(groupedData).forEach(([date, totals]) => {
            const row = summaryTable.insertRow();
            const totalAmount = totals.totalIncome - totals.totalExpense;
            row.innerHTML = `
                <td>${formatDateForDisplay(date)}</td>
                <td>${totals.totalIncome.toFixed(2)}</td>
                <td>${totals.totalExpense.toFixed(2)}</td>
                <td>${totalAmount.toFixed(2)}</td>
            `;
            row.addEventListener('click', () => {
                currentDate = new Date(date);
                updateCurrentDate();
                loadDateData(currentDate);
                document.querySelector('.tab-btn[data-tab="input"]').click();
            });
        });
    } catch (error) {
        console.error('Error loading summary data: ', error);
        alert('Error loading summary data. Please try again.');
    }
}

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

// Initial data load
loadDateData(currentDate);
loadSummaryData();