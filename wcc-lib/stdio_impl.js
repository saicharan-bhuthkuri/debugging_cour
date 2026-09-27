export const STDIO_H = `#pragma once

#include <stdarg.h>
#include <stddef.h>
#include <sys/types.h>  // ssize_t

#define EOF  (-1)

enum {
  SEEK_SET,  // 0
  SEEK_CUR,  // 1
  SEEK_END,  // 2
};

typedef struct FILE FILE;

#ifdef __APPLE__
extern FILE *__stdinp;
extern FILE *__stdoutp;
extern FILE *__stderrp;
#define stdin   __stdinp
#define stdout  __stdoutp
#define stderr  __stderrp

#elif defined(__riscv)

// Must match with newlib
struct _reent
{
  int _errno;

  struct FILE *_stdin, *_stdout, *_stderr;
};

extern struct _reent *_impure_ptr;

#define stdin   (_impure_ptr->_stdin)
#define stdout  (_impure_ptr->_stdout)
#define stderr  (_impure_ptr->_stderr)

#else
extern FILE *stdin;
extern FILE *stdout;
extern FILE *stderr;
#endif

FILE *fopen(const char *fileName, const char *mode);
FILE *fdopen(int fd, const char *mode);
int fclose(FILE *fp);
size_t fwrite(const void *buffer, size_t size, size_t count, FILE *fp);
size_t fread(void *buffer, size_t size, size_t count, FILE *fp);
int fflush(FILE *fp);
int fseek(FILE *fp, long offset, int origin);
long ftell(FILE *fp);
int feof(FILE *fp);
int remove(const char *fn);

int fgetc(FILE *fp);
int fputc(int c, FILE *fp);
char *fgets(char *s, int n, FILE *fp);
int fputs(const char *s, FILE *fp);
int puts(const char *s);
int ungetc(int c, FILE *fp);

#define getc(fp)     fgetc(fp)
#define getchar()    fgetc(stdin)
#define putc(c, fp)  fputc(c, fp)
#define putchar(c)   fputc(c, stdout)

int fprintf(FILE *fp, const char *fmt, ...);
int printf(const char *fmt, ...);
int sprintf(char *out, const char *fmt, ...);
int snprintf(char *, size_t n, const char *, ...);
int vprintf(const char *fmt, va_list ap);
int vsprintf(char *buf, const char *fmt, va_list ap);
int vfprintf(FILE *fp, const char *fmt, va_list ap);
int vsnprintf(char *out, size_t n, const char *fmt_, va_list ap);

void perror(const char*);

int fileno(FILE *fp);
FILE *tmpfile(void);

ssize_t getline(char **lineptr, size_t *n, FILE *stream);

FILE *fmemopen(void *buf, size_t size, const char *mode);
FILE *open_memstream(char **ptr, size_t *sizeloc);

/* =========================================================================
 * Formatted Input Engine: scanf, sscanf, fscanf, vfscanf, vsscanf
 * ========================================================================= */

typedef struct {
    FILE *fp;
    const char *str;
    int pos;
    int ungotten;
    int has_ungotten;
    int chars_read;
} _WccScanfReader;

static inline int _wcc_reader_getc(_WccScanfReader *r) {
    if (r->has_ungotten) {
        r->has_ungotten = 0;
        r->chars_read++;
        return r->ungotten;
    }
    int c;
    if (r->fp) {
        c = fgetc(r->fp);
    } else {
        c = (unsigned char)r->str[r->pos];
        if (c == '\\0') c = EOF;
        else r->pos++;
    }
    if (c != EOF) r->chars_read++;
    return c;
}

static inline void _wcc_reader_ungetc(int c, _WccScanfReader *r) {
    if (c == EOF) return;
    r->chars_read--;
    if (r->fp) {
        ungetc(c, r->fp);
    } else {
        if (r->pos > 0 && !r->has_ungotten) {
            r->pos--;
        } else {
            r->ungotten = c;
            r->has_ungotten = 1;
        }
    }
}

static inline int _wcc_isspace(int c) {
    return c == ' ' || c == '\\t' || c == '\\n' || c == '\\r' || c == '\\f' || c == '\\v';
}

static inline int _wcc_isdigit(int c) {
    return c >= '0' && c <= '9';
}

static inline int _wcc_internal_vscanf(_WccScanfReader *r, const char *fmt, va_list ap) {
    int assigned = 0;
    int c;

    while (*fmt) {
        if (_wcc_isspace((unsigned char)*fmt)) {
            while (_wcc_isspace((unsigned char)*fmt)) fmt++;
            c = _wcc_reader_getc(r);
            while (c != EOF && _wcc_isspace(c)) {
                c = _wcc_reader_getc(r);
            }
            if (c != EOF) _wcc_reader_ungetc(c, r);
            continue;
        }

        if (*fmt != '%') {
            c = _wcc_reader_getc(r);
            if (c != *fmt) {
                if (c != EOF) _wcc_reader_ungetc(c, r);
                return assigned > 0 ? assigned : (c == EOF ? EOF : 0);
            }
            fmt++;
            continue;
        }

        fmt++; // Skip '%'
        if (*fmt == '%') {
            c = _wcc_reader_getc(r);
            if (c != '%') {
                if (c != EOF) _wcc_reader_ungetc(c, r);
                return assigned > 0 ? assigned : (c == EOF ? EOF : 0);
            }
            fmt++;
            continue;
        }

        // Width specifier (optional)
        int width = -1;
        if (_wcc_isdigit((unsigned char)*fmt)) {
            width = 0;
            while (_wcc_isdigit((unsigned char)*fmt)) {
                width = width * 10 + (*fmt - '0');
                fmt++;
            }
        }

        // Length modifiers: l, ll, h
        int length = 0; // 0=default, 1=l, 2=ll, -1=h
        if (*fmt == 'l') {
            length = 1;
            fmt++;
            if (*fmt == 'l') {
                length = 2;
                fmt++;
            }
        } else if (*fmt == 'h') {
            length = -1;
            fmt++;
        }

        char spec = *fmt++;

        if (spec == 'n') {
            int *ptr = va_arg(ap, int*);
            if (ptr) *ptr = r->chars_read;
            continue;
        }

        // For non-%c specifiers, skip leading whitespace
        if (spec != 'c') {
            c = _wcc_reader_getc(r);
            while (c != EOF && _wcc_isspace(c)) {
                c = _wcc_reader_getc(r);
            }
            if (c == EOF) {
                return assigned > 0 ? assigned : EOF;
            }
            _wcc_reader_ungetc(c, r);
        }

        if (spec == 'c') {
            char *dest = va_arg(ap, char*);
            int count = (width > 0) ? width : 1;
            int i;
            for (i = 0; i < count; i++) {
                c = _wcc_reader_getc(r);
                if (c == EOF) break;
                dest[i] = (char)c;
            }
            if (i == 0) return assigned > 0 ? assigned : EOF;
            assigned++;
        } else if (spec == 's') {
            char *dest = va_arg(ap, char*);
            int i = 0;
            while (width <= 0 || i < width) {
                c = _wcc_reader_getc(r);
                if (c == EOF || _wcc_isspace(c)) {
                    if (c != EOF) _wcc_reader_ungetc(c, r);
                    break;
                }
                dest[i++] = (char)c;
            }
            dest[i] = '\\0';
            if (i == 0) return assigned > 0 ? assigned : EOF;
            assigned++;
        } else if (spec == 'd' || spec == 'i' || spec == 'u' || spec == 'x' || spec == 'X' || spec == 'o') {
            c = _wcc_reader_getc(r);
            if (c == EOF) return assigned > 0 ? assigned : EOF;
            int sign = 1;
            if (c == '-' || c == '+') {
                if (c == '-') sign = -1;
                c = _wcc_reader_getc(r);
            }

            int base = 10;
            if (spec == 'x' || spec == 'X') base = 16;
            else if (spec == 'o') base = 8;
            else if (spec == 'i') {
                if (c == '0') {
                    int c2 = _wcc_reader_getc(r);
                    if (c2 == 'x' || c2 == 'X') {
                        base = 16;
                        c = _wcc_reader_getc(r);
                    } else {
                        base = 8;
                        _wcc_reader_ungetc(c2, r);
                    }
                }
            }

            long long val = 0;
            int digits = 0;
            while (c != EOF) {
                int digit_val = -1;
                if (c >= '0' && c <= '9') digit_val = c - '0';
                else if (base == 16 && c >= 'a' && c <= 'f') digit_val = c - 'a' + 10;
                else if (base == 16 && c >= 'A' && c <= 'F') digit_val = c - 'A' + 10;

                if (digit_val < 0 || digit_val >= base) break;

                val = val * base + digit_val;
                digits++;
                if (width > 0 && digits >= width) {
                    c = _wcc_reader_getc(r);
                    break;
                }
                c = _wcc_reader_getc(r);
            }
            if (c != EOF) _wcc_reader_ungetc(c, r);

            if (digits == 0) {
                return assigned > 0 ? assigned : (c == EOF ? EOF : 0);
            }

            val *= sign;
            if (length == 2) {
                *(long long*)va_arg(ap, void*) = val;
            } else if (length == 1) {
                *(long*)va_arg(ap, void*) = (long)val;
            } else if (length == -1) {
                *(short*)va_arg(ap, void*) = (short)val;
            } else {
                *(int*)va_arg(ap, void*) = (int)val;
            }
            assigned++;
        } else if (spec == 'f' || spec == 'e' || spec == 'E' || spec == 'g' || spec == 'G') {
            c = _wcc_reader_getc(r);
            if (c == EOF) return assigned > 0 ? assigned : EOF;
            int sign = 1;
            if (c == '-' || c == '+') {
                if (c == '-') sign = -1;
                c = _wcc_reader_getc(r);
            }

            double val = 0.0;
            int digits = 0;
            while (c >= '0' && c <= '9') {
                val = val * 10.0 + (c - '0');
                digits++;
                c = _wcc_reader_getc(r);
            }

            if (c == '.') {
                c = _wcc_reader_getc(r);
                double frac = 0.1;
                while (c >= '0' && c <= '9') {
                    val += (c - '0') * frac;
                    frac *= 0.1;
                    digits++;
                    c = _wcc_reader_getc(r);
                }
            }

            if (digits == 0) {
                if (c != EOF) _wcc_reader_ungetc(c, r);
                return assigned > 0 ? assigned : 0;
            }

            if (c == 'e' || c == 'E') {
                int exp_sign = 1;
                c = _wcc_reader_getc(r);
                if (c == '-' || c == '+') {
                    if (c == '-') exp_sign = -1;
                    c = _wcc_reader_getc(r);
                }
                int exp_val = 0;
                while (c >= '0' && c <= '9') {
                    exp_val = exp_val * 10 + (c - '0');
                    c = _wcc_reader_getc(r);
                }
                double factor = 1.0;
                for (int j = 0; j < exp_val; j++) factor *= 10.0;
                if (exp_sign < 0) val /= factor;
                else val *= factor;
            }
            if (c != EOF) _wcc_reader_ungetc(c, r);

            val *= sign;
            if (length == 1) { // %lf
                *(double*)va_arg(ap, double*) = val;
            } else { // %f
                *(float*)va_arg(ap, float*) = (float)val;
            }
            assigned++;
        }
    }

    return assigned;
}

static inline int vfscanf(FILE *fp, const char *fmt, va_list ap) {
    _WccScanfReader r = { fp, NULL, 0, 0, 0, 0 };
    return _wcc_internal_vscanf(&r, fmt, ap);
}

static inline int vsscanf(const char *str, const char *fmt, va_list ap) {
    _WccScanfReader r = { NULL, str, 0, 0, 0, 0 };
    return _wcc_internal_vscanf(&r, fmt, ap);
}

static inline int fscanf(FILE *fp, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int res = vfscanf(fp, fmt, ap);
    va_end(ap);
    return res;
}

static inline int scanf(const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int res = vfscanf(stdin, fmt, ap);
    va_end(ap);
    return res;
}

static inline int sscanf(const char *str, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    int res = vsscanf(str, fmt, ap);
    va_end(ap);
    return res;
}
`;
