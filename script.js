document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeIcon = document.getElementById('darkModeIcon');
    const htmlElement = document.documentElement;

    const currentTheme = localStorage.getItem('theme') || 'light';

    applyTheme(currentTheme);
    
    darkModeToggle.addEventListener('click', function() {
        const currentTheme = htmlElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        darkModeToggle.classList.add('clicked');

        setTimeout(() => {
            applyTheme(newTheme);
            localStorage.setItem('theme', newTheme);
        }, 100);

        setTimeout(() => {
            darkModeToggle.classList.remove('clicked');
        }, 600);
    });
    
    function applyTheme(theme) {
        htmlElement.setAttribute('data-theme', theme);
        
        if (theme === 'dark') {
            darkModeIcon.className = 'fa-solid fa-sun';
            darkModeIcon.style.color = '#ffffff';
            darkModeToggle.setAttribute('aria-label', 'Cambiar a modo claro');
        } else {
            darkModeIcon.className = 'fa-solid fa-moon';
            darkModeIcon.style.color = '';
            darkModeToggle.setAttribute('aria-label', 'Cambiar a modo oscuro');
        }
    }

    function updateGreeting() {
        const greetingElement = document.getElementById('greetingText');
        const currentHour = new Date().getHours();
        let greeting = '';
        
        if (currentHour >= 5 && currentHour < 12) {
            greeting = '¡Buenos días!';
        } else if (currentHour >= 12 && currentHour < 18) {
            greeting = '¡Buenas tardes!';
        } else if (currentHour >= 18 && currentHour < 22) {
            greeting = '¡Buenas noches!';
        } else {
            greeting = '¡Hola!';
        }
        
        greetingElement.style.opacity = '0';
        greetingElement.style.transform = 'translateY(10px)';
        
        setTimeout(() => {
            greetingElement.textContent = greeting;
            greetingElement.style.opacity = '1';
            greetingElement.style.transform = 'translateY(0)';
        }, 200);
    }

    updateGreeting();

    setInterval(updateGreeting, 3600000);
});

const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
