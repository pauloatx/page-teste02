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

    //script.js cadastro.html

    document.addEventListener("DOMContentLoaded", function () {
        // Se existir função de animação para elementos com data-animate, ela pode ser chamada aqui.
        const animatedElements = document.querySelectorAll("[data-animate]");
        if (typeof animateOnScroll === "function") {
          animateOnScroll(animatedElements);
        }
      
        const form = document.getElementById("cadastro-form");
        const mensagem = document.getElementById("mensagem");
      
        form.addEventListener("submit", async function (event) {
          event.preventDefault(); // Evita recarregar a página
      
          const nome = document.getElementById("nome").value;
          const email = document.getElementById("email").value;
          const telefone = document.getElementById("telefone").value;
          const descricao_servico = document.getElementById("descricao_servico").value;
          const data_servico = document.getElementById("data_servico").value;
      
          const dados = {
            nome,
            email,
            telefone,
            descricao_servico,
            data_servico,
          };
      
          try {
            // Usa o endpoint relativo da API definida no server.js
            const resposta = await fetch("https://page-teste02.onrender.com/api/atendimentos", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(dados),
            });
      
            const resultado = await resposta.json();
      
            if (resposta.ok) {
              mensagem.textContent = "Atendimento cadastrado com sucesso!";
              mensagem.style.color = "green";
              form.reset();
            } else {
              mensagem.textContent = resultado.errors
                ? resultado.errors.map((err) => err.msg).join(", ")
                : "Erro ao cadastrar.";
              mensagem.style.color = "red";
            }
          } catch (erro) {
            console.error("Erro ao enviar requisição:", erro);
            mensagem.textContent = "Erro ao conectar ao servidor.";
            mensagem.style.color = "red";
          }
        });
      });
      



