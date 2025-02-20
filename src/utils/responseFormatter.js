class ResponseFormatter {
    static success(data = null, message = 'Success') {
        return {
            status: 'success',
            message,
            data,
            timestamp: new Date().toISOString()
        };
    }

    static error(message = 'Error', code = 500, details = null) {
        return {
            status: 'error',
            code,
            message,
            details,
            timestamp: new Date().toISOString()
        };
    }

    static list(items, total = null, page = null, limit = null) {
        return this.success({
            items,
            pagination: page ? {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            } : null
        });
    }

    static created(data = null, message = 'Resource created successfully') {
        return this.success(data, message);
    }

    static updated(data = null, message = 'Resource updated successfully') {
        return this.success(data, message);
    }

    static deleted(message = 'Resource deleted successfully') {
        return this.success(null, message);
    }
}

module.exports = ResponseFormatter; 