// ARM64 Linux Hello World - raw syscalls, no libc
// System call numbers for ARM64 Linux:
//   write = 64
//   exit  = 93

.global _start

.section .data
msg:    .ascii "Hello, World!\n"
len = . - msg

.section .text
_start:
    // write(1, msg, len)
    mov     x0, #1          // fd = stdout
    ldr     x1, =msg        // buf = address of message
    mov     x2, #len        // count = length of message
    mov     x8, #64         // syscall number for write
    svc     #0              // invoke syscall

    // exit(0)
    mov     x0, #0          // status = 0
    mov     x8, #93         // syscall number for exit
    svc     #0              // invoke syscall
