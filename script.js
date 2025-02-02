document.addEventListener('DOMContentLoaded', () => {
    const animateOnScroll = (elements) => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;

                if (entry.isIntersecting) {
                    element.style.animation = 'none'; // Reinicia a animação removendo-a temporariamente
                    void element.offsetWidth; // Reflow para forçar a atualização do CSS
                    element.style.animation = ''; // Permite que a animação seja reaplicada
                    element.style.animationDelay = element.dataset.delay || '0ms';
                    element.style.setProperty('--animation-timing', element.dataset.timing || '1s');
                    element.classList.add('animated');
                } else {
                    element.classList.remove('animated'); // Remove a classe para reiniciar ao reaparecer
                }
            });
        }, {
            threshold: 0.2,
            rootMargin: '0px 0px -50px 0px'
        });

        elements.forEach(element => {
            element.style.setProperty('--animation-timing', element.dataset.timing || '1s');
            observer.observe(element);
        });
    };

    // Seleciona todos os elementos que possuem animação
    const animatedElements = document.querySelectorAll('[data-animate]');
    animateOnScroll(animatedElements);
});
