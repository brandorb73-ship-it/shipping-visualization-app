/* ==========================================
   GLOBAL SETTINGS
   ========================================== */
window.ACCESS_KEY = "Cyber$supe73r"; 
window.DB_URL = "https://script.google.com/macros/s/AKfycbyRBE6_yUjzOPfLjis4OyK6XVtuWIBOmV9khY1cJ6_iQTCldqQbec7jtNmpiAL8-MI9/exec"; 

/* ==========================================
   LOGO UPLOAD (FORCED GLOBAL)
   ========================================== */
window.handleLogoUpload = function(input) {
    console.log("Logo upload triggered");
    if (input.files && input.files[0]) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var imageData = e.target.result;
            localStorage.setItem('brandorb_logo', imageData);
            
            // Update all logos on page
            var logos = document.querySelectorAll('.global-logo-src');
            logos.forEach(function(img) {
                img.src = imageData;
                img.style.display = 'block';
            });

            // Update login preview
            var preview = document.getElementById('login-display-logo');
            var placeholder = document.getElementById('login-logo-placeholder');
            if (preview) { preview.src = imageData; preview.style.display = 'block'; }
            if (placeholder) { placeholder.style.display = 'none'; }
            console.log("Logo updated successfully");
        };
        reader.readAsDataURL(input.files[0]);
    }
};

/* ==========================================
   LOGIN (FORCED GLOBAL)
   ========================================== */
window.attemptLogin = function() {
    var enteredPass = document.getElementById('pass-input').value;
    var errorMsg = document.getElementById('login-error');
    
    console.log("Login attempt...");

    if (enteredPass === window.ACCESS_KEY) {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
        sessionStorage.setItem('isLoggedIn', 'true');
        console.log("Login successful");
        
        // Load data if URL is provided
        if (window.DB_URL && window.DB_URL !== "YOUR_APPS_SCRIPT_URL") {
            fetchReports();
        }
    } else {
        if (errorMsg) errorMsg.style.display = 'block';
        console.log("Login failed");
    }
};

/* ==========================================
   INITIALIZE ON LOAD
   ========================================== */
window.onload = function() {
    console.log("Page loaded. Checking storage...");
    
    // Restore Logo
    var savedLogo = localStorage.getItem('brandorb_logo');
    if (savedLogo) {
        window.handleLogoUpload({ files: null }); // Trigger internal logic or:
        document.querySelectorAll('.global-logo-src').forEach(function(img) {
            img.src = savedLogo;
            img.style.display = 'block';
        });
    }

    // Restore Session
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-container').style.display = 'flex';
    }
};

// Placeholder for fetchReports so the script doesn't crash if called
window.fetchReports = function() {
    console.log("Fetching reports from: " + window.DB_URL);
    // Add your existing fetch logic here later
};
