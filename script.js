document.addEventListener("DOMContentLoaded", function () {
    const elementos = document.querySelectorAll(".contweb, .contmobile, .contdados");

    const observer = new IntersectionObserver((entradas, observer) => {
        entradas.forEach(entrada => {
            if (entrada.isIntersecting) {
                entrada.target.classList.add("apareceu"); // Adiciona a classe quando o elemento estiver visível
                observer.unobserve(entrada.target); // Para de observar o elemento após ele aparecer
            }
        });
    }, {
        threshold: 0.5  // O elemento precisa estar 50% visível
    });

    elementos.forEach(elemento => {
        observer.observe(elemento); // Observa os elementos
    });
});
