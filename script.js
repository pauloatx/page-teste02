document.addEventListener('DOMContentLoaded', () => {
    const animateOnScroll = (elements) => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;
                
                if(entry.isIntersecting) {
                    // Prepara a animação
                    element.style.animationDelay = element.dataset.delay || '0ms';
                    element.style.animationDuration = element.dataset.timing || '1s';
                    
                    // Reinicia a animação
                    element.classList.remove('animate-active');
                    void element.offsetWidth; // Força recálculo do layout
                    element.classList.add('animate-active');
                } else {
                    // Reseta o estado para permitir nova animação
                    element.classList.remove('animate-active');
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -50px 0px'
        });

        elements.forEach(element => {
            observer.observe(element);
        });
    };

    const animatedElements = document.querySelectorAll('[data-animate]');
    animateOnScroll(animatedElements);
});