// ==============================================================================
// ExamSphere – Standardized API Response Wrapper
// ==============================================================================

export class ApiResponse {
  /**
   * @param {number} statusCode
   * @param {*} data
   * @param {string} message
   * @param {*} pagination
   */
  constructor(statusCode = 200, data = null, message = 'Success', pagination = null) {
    this.statusCode = typeof statusCode === 'number' ? statusCode : 200;
    this.success = this.statusCode < 400;
    this.message = message;
    this.data = data;
    if (pagination || (typeof statusCode === 'object' && statusCode !== null)) {
      this.pagination = pagination || statusCode;
    }
    this.timestamp = new Date().toISOString();
  }

  static success(data, message = 'Success', paginationOrStatusCode = 200) {
    if (typeof paginationOrStatusCode === 'object' && paginationOrStatusCode !== null) {
      return new ApiResponse(200, data, message, paginationOrStatusCode);
    }
    return new ApiResponse(paginationOrStatusCode, data, message);
  }

  static created(data, message = 'Resource created successfully') {
    return new ApiResponse(201, data, message);
  }
}
