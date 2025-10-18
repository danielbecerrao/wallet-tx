
## 1. ¿Cómo manejarías picos altos de transacciones para garantizar escalabilidad?

Trabajaría con una arquitectura horizonal sin estado, pasando por un api gateway con monitoreo de CPU y ram para el escalado horizontal, también podría monitorear la cola de peticiones

  

## 2. ¿Qué estrategias usarías para prevenir fraudes en un sistema de billetera digital?

El uso de reglas en tiempo real para monitorear cada una de las transacciones como montos altos, horarios, ubicaciones, IPs, dispositivos desconocidos, cantidad de transacciones en un tiempo corto, también tendría unas reglas generales y personalizadas para bloquear transacciones por monto, horario y cantidad de transacciones por dia.

  
  

## 3. Si detectas lentitud en el procesamiento de transacciones por alta concurrencia, ¿cómo procederías para mejorar el rendimiento?

Entrar a detectar cuales son las consultas o transacciones que bloquean procesos o tienen lentitud (P95/P99).

Mejoraría procesos que pueden ser asíncronos o en segundo plano, procesamiento por lotes, escalado horizontal y vertical donde se necesite, también se puede implementar patrones como CQRS donde la base de datos de consulta sea rápida y la de escritura sea ACID con consistencia eventual.