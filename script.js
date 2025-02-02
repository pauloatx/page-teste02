document.addEventListener('DOMContentLoaded', () => {
    const animateOnScroll = (elements) => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if(entry.isIntersecting) {
                    const element = entry.target;
                    // Aplica os parâmetros da animação
                    element.style.animationDelay = element.dataset.delay || '0ms';
                    element.style.animationDuration = element.dataset.timing || '1s';
                    
                    // Força o recálculo do layout para disparar a animação
                    void element.offsetWidth;
                    
                    // Adiciona a classe que ativa a animação
                    element.classList.add('animate-active');
                    
                    // Para de observar após a ativação
                    observer.unobserve(element);
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